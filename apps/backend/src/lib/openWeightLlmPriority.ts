import type { OpenWeightLlmTaskType } from '@arsnova/shared-types';
import { getRedis } from '../redis';

export const OPEN_WEIGHT_LLM_LEASE_KEY = 'llm:inference:lease:v1';
const PRIORITY_STATE_KEY = 'llm:inference:priority:v1';
const PREEMPTED_KEY_PREFIX = `${PRIORITY_STATE_KEY}:preempted:`;
const MAX_WAITERS_BY_PRIORITY = [8, 8, 16] as const;
const GRACE_MS = 15_000;

export const OPEN_WEIGHT_LLM_TASK_PRIORITY: Record<OpenWeightLlmTaskType, number> = {
  learning_objectives: 1,
  qa_summary: 2,
  topic_label: 3,
};

export function isOpenWeightLlmPriorityEnabled(env = process.env): boolean {
  return (
    env['OPEN_WEIGHT_LLM_SHARED_SLOT_ENABLED'] === 'true' &&
    env['OPEN_WEIGHT_LLM_PRIORITY_HANDOFF_ENABLED'] === 'true'
  );
}

// All admission and ownership decisions run in one Lua script on the shared Redis.
// The lease key also remains the authority for legacy replicas and maintenance tools.
const SCHEDULE = `
local command, id = ARGV[1], ARGV[2]
local grace, markerPrefix = tonumber(ARGV[3]), ARGV[4]
local priority, waitMs, expected = tonumber(ARGV[5]), tonumber(ARGV[6]), ARGV[7]
local owner = redis.call('GET', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
local state = cjson.decode(redis.call('GET', KEYS[2]) or '{}')
local active = state.active
local dirty = false
if active and active.id ~= owner then
  active = nil
  dirty = true
end

local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local queue = {}
local waitersWithPriority = 0
local ownIndex, headIndex
local expiry = 0
for _, waiter in ipairs(state.queue or {}) do
  if waiter.expires > now and not (command == 'finish' and waiter.id == id) then
    table.insert(queue, waiter)
    if waiter.id == id then ownIndex = #queue end
    if waiter.priority == priority then waitersWithPriority = waitersWithPriority + 1 end
    if not headIndex or waiter.priority > queue[headIndex].priority then headIndex = #queue end
    expiry = math.max(expiry, waiter.expires - now)
  else
    dirty = true
  end
end

local function save()
  if not dirty then return end
  if active or #queue > 0 then
    redis.call('SET', KEYS[2], cjson.encode({ active = active, queue = queue }),
      'PX', math.max(ttl, expiry) + grace)
  else
    redis.call('DEL', KEYS[2])
  end
end

if command == 'finish' then
  local preempted = redis.call('EXISTS', markerPrefix .. id) == 1
  if owner == id then
    redis.call('DEL', KEYS[1])
    active = nil
    dirty = true
  end
  save()
  if preempted and (owner ~= id or expected ~= 'completed') then return {'preempted'} end
  return {owner == id and 'owned' or 'lost'}
end

if command == 'begin' then
  if not active or owner ~= id then return {'lost'} end
  if active.preempted then
    if headIndex and queue[headIndex].priority > active.priority then return {'preempted'} end
    -- A waiting replacement disappeared before this request reached the model.
    active.preempted = nil
    redis.call('DEL', markerPrefix .. id)
  end
  active.started = true
  ttl = waitMs
  redis.call('PEXPIRE', KEYS[1], ttl)
  dirty = true
  save()
  return {'owned'}
end

if command == 'wait' and not ownIndex then
  local limits = {${MAX_WAITERS_BY_PRIORITY.join(', ')}}
  if waitMs <= 0 or waitersWithPriority >= limits[priority] then
    save()
    return {'rejected'}
  end
  table.insert(queue, { id = id, priority = priority, expires = now + waitMs })
  dirty = true
  ownIndex = #queue
  if not headIndex or priority > queue[headIndex].priority then headIndex = ownIndex end
  expiry = math.max(expiry, waitMs)
end

if not ownIndex or headIndex ~= ownIndex then
  save()
  return {'waiting'}
end

local canTakeOver = command == 'takeover' and active and active.id == expected and
  active.started and active.preempted and priority > active.priority
if not owner or canTakeOver then
  if waitMs <= 0 then return {'rejected'} end
  table.remove(queue, ownIndex)
  ttl = waitMs
  active = { id = id, priority = priority }
  redis.call('SET', KEYS[1], id, 'PX', ttl)
  dirty = true
  save()
  return {'admitted'}
end

if active and priority > active.priority then
  if not active.preempted then
    active.preempted = true
    redis.call('SET', markerPrefix .. owner, '1', 'PX', math.max(0, ttl) + grace)
    dirty = true
  end
  save()
  if active.started then return {'interrupt', owner} end
else
  save()
end
return {'waiting'}
`;

export type OpenWeightLlmPriorityTicket = Readonly<{
  id: string;
  taskType: OpenWeightLlmTaskType;
}>;

export type OpenWeightLlmPriorityDecision =
  { status: 'admitted' | 'waiting' | 'rejected' } | { status: 'interrupt'; owner: string };

type PriorityOwnership = 'owned' | 'preempted' | 'lost';

async function runCommand(
  command: 'wait' | 'begin' | 'takeover' | 'finish',
  ticket: OpenWeightLlmPriorityTicket,
  ttlMs: number,
  expectedOwner = '',
): Promise<unknown> {
  return getRedis().eval(
    SCHEDULE,
    2,
    OPEN_WEIGHT_LLM_LEASE_KEY,
    PRIORITY_STATE_KEY,
    command,
    ticket.id,
    GRACE_MS,
    PREEMPTED_KEY_PREFIX,
    OPEN_WEIGHT_LLM_TASK_PRIORITY[ticket.taskType],
    Math.max(0, Math.ceil(ttlMs)),
    expectedOwner,
  );
}

export async function admitOpenWeightLlmPriorityTicket(
  ticket: OpenWeightLlmPriorityTicket,
  waitMs: number,
  releasedOwner?: string,
): Promise<OpenWeightLlmPriorityDecision> {
  const answer = await runCommand(
    releasedOwner ? 'takeover' : 'wait',
    ticket,
    waitMs,
    releasedOwner,
  );
  if (Array.isArray(answer)) {
    const [status, owner] = answer as unknown[];
    if (status === 'admitted' || status === 'waiting' || status === 'rejected') return { status };
    if (status === 'interrupt' && typeof owner === 'string') return { status, owner };
  }
  throw new Error('Invalid inference scheduler response');
}

async function updateOwnership(
  command: 'begin' | 'finish',
  ticket: OpenWeightLlmPriorityTicket,
  ttlMs: number,
  completion = '',
): Promise<PriorityOwnership> {
  const answer = await runCommand(command, ticket, ttlMs, completion);
  const status: unknown = Array.isArray(answer) ? answer[0] : undefined;
  if (status === 'owned' || status === 'preempted' || status === 'lost') return status;
  throw new Error('Invalid inference scheduler ownership response');
}

export function beginOpenWeightLlmPriorityTicket(
  ticket: OpenWeightLlmPriorityTicket,
  ttlMs: number,
): Promise<PriorityOwnership> {
  return updateOwnership('begin', ticket, ttlMs);
}

export function finishOpenWeightLlmPriorityTicket(
  ticket: OpenWeightLlmPriorityTicket,
  completed = false,
): Promise<PriorityOwnership> {
  return updateOwnership('finish', ticket, 0, completed ? 'completed' : '');
}
