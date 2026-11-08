/** 2C – Lokale Q&A-Kurzfassungen mit kontrolliertem Kontext und Ausgabelimit. */
import { it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import * as S from '@arsnova/shared-types';
import { canonicalModerationPromptJson as canon } from './moderationPromptContextPacking';
import {
  prepareModerationSummaryContextFromAnalysis as baseline,
  resolveQaSummaryAdapterPlan,
} from './moderationSummaryContext';
import { resetOpenWeightLlmClientForTests } from './openWeightLlmClient';
import { runPreparedQaSummary } from './qaSummaryRuntimeAdapter';
import { bindQaSummaryModelOutputV2 as bind } from './qaSummaryValidateV2';

const dir = process.env.EVIDENCE!;
const series = process.env.SERIE!;
const extended = series === 'erweitert';
const limit = series === '640' ? 640 : 1024;
const now = new Date('2026-01-15T10:05:00Z');
const save = (name: string, obj: any) =>
  writeFileSync(dir + '/' + name, JSON.stringify(obj, null, 2) + '\n');
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const trials: any[] = [];
const url = 'http://127.0.0.1:8080';
const plain = (q: any) => ({ id: q.id, text: q.content.text });
type Case = 'S6' | 'S100' | 'long100' | 'meta6';
const scenarios: Case[] = ['long100', 'meta6'];
function fixture(key: Case) {
  const n = key === 'S6' || key === 'meta6' ? 6 : 100;
  const f = JSON.parse(readFileSync('/study/eingaben/S' + n + '.json', 'utf8'));
  const questions = f.context.sources.filter((s: any) => s.kind === 'qa-question');
  if (key === 'long100') {
    for (const q of questions)
      q.content.text +=
        ' Könnten Sie die Begründung im nächsten Termin ausführlicher erläutern?'.repeat(5);
  }
  return S.ModerationAnalysisContextV1Schema.parse(f);
}
const plan = {
  ...resolveQaSummaryAdapterPlan(),
  selectedMode: 'full-context' as const,
  inferenceConfigured: true,
  fallback: null,
};
function prepare(key: Case) {
  const analysis = fixture(key);
  const prep = baseline({ analysis, plan, packedAt: now });
  const packed = prep.request.promptContext;
  const sources = packed.context.sources.filter(
    (s: any) => s.kind === 'qa-question' && s.content.state === 'included',
  );
  const visible = sources.map(plain);
  const n =
    analysis.context.questions.state === 'available' ? analysis.context.questions.corpus.total : 0;
  const items =
    analysis.context.questions.state === 'available' ? analysis.context.questions.items : [];
  const minimal = visible.map((q) => {
    const item = items.find((x) => x.sourceId === q.id)!;
    return { ...q, status: item.status, votes: item.votes };
  });
  return { key, n, analysis, prep, packed, visible, minimal };
}
it('recorded local summary experiment', async () => {
  const keys: Case[] = extended ? scenarios : ['S6', 'S100'];
  const cases = new Map(keys.map((key) => [key, prepare(key)]));
  for (const [key, d] of cases) {
    save('fixture-' + key + '.json', d.analysis);
    save('context-' + key + '-A.json', d.packed);
    save('context-' + key + '-B.json', key === 'meta6' ? d.minimal : d.visible);
  }
  if (process.env.ONLY_PACK === '1') return;
  const token = process.env.STUDY_TOKEN!,
    auth = { authorization: 'Bearer ' + token };
  const abort = Date.now() + 720000;
  async function run(key: Case, arm: string, rep: number) {
    const id = series + '-' + (rep === 0 ? 'P' : 'R') + rep + '-' + key + '-' + arm;
    const d = cases.get(key)!;
    const n = d.n;
    if (Date.now() > abort) throw Error('12 minute study deadline');
    if (existsSync(dir + '/' + id + '.json')) throw Error('Existing run ' + id);
    // Fresh KV state before timing, same for every condition.
    const erase = await fetch(url + '/slots/0?action=erase', {
      method: 'POST',
      headers: auth,
      signal: AbortSignal.timeout(5000),
    });
    if (!erase.ok) throw Error('Cannot clear slot ' + erase.status + ' ' + (await erase.text()));
    const t0 = performance.now(),
      rec: any = { id, n, arm, rep, fixtureSha256: hash(canon(d.analysis)), kvErased: true };
    const pp = baseline({ analysis: d.analysis, plan, packedAt: now });
    rec.packMs = performance.now() - t0;
    resetOpenWeightLlmClientForTests({
      request: async (input) => {
        if (input.method === 'GET') {
          const s = await fetch(url + input.path, { headers: input.headers, signal: input.signal });
          return { status: s.status, body: await s.text() };
        }
        const b = JSON.parse(input.body!);
        if (arm === 'B') {
          b.messages[2].content = canon(key === 'meta6' ? d.minimal : d.visible);
          const allowed = d.visible.map((q) => q.id);
          const grammar = b.response_format.schema.properties.output.properties;
          for (const section of ['statements', 'suggestedNextSteps']) {
            grammar[section].items.properties.sourceIds.items.enum = allowed;
          }
        }
        expect(b.max_tokens).toBe(640);
        b.max_tokens = limit;
        b.stream = true;
        b.stream_options = { include_usage: true };
        b.seed = 456;
        b.cache_prompt = false;
        rec.wireSha256 = hash(JSON.stringify(b));
        save('request-' + key + '-' + arm + '.json', b);
        const start = performance.now();
        rec.rawContent = '';
        const http = await fetch(url + input.path, {
          method: 'POST',
          headers: input.headers,
          body: JSON.stringify(b),
          signal: input.signal,
        });
        rec.http = http.status;
        if (!http.ok) {
          rec.transportError = await http.text();
          return { status: http.status, body: rec.transportError };
        }
        let buf = '';
        const decoder = new TextDecoder();
        for await (const chunk of http.body!) {
          buf += decoder.decode(chunk, { stream: true });
          let at;
          while ((at = buf.indexOf('\n')) >= 0) {
            const ln = buf.slice(0, at).trim();
            buf = buf.slice(at + 1);
            if (!ln.startsWith('data:') || ln.includes('[DONE]')) continue;
            const e = JSON.parse(ln.slice(5));
            if (e.usage) rec.usage = e.usage;
            if (e.timings) rec.timings = e.timings;
            const ch = e.choices?.[0];
            if (ch?.finish_reason) rec.finish = ch.finish_reason;
            if (ch?.delta?.content) {
              rec.ttftMs ??= performance.now() - start;
              rec.rawContent += ch.delta.content;
            }
          }
        }
        rec.requestMs = performance.now() - start;
        return {
          status: http.status,
          body: JSON.stringify({
            model: b.model,
            choices: [{ message: { content: rec.rawContent }, finish_reason: rec.finish }],
            usage: rec.usage,
            timings: rec.timings,
          }),
        };
      },
    });
    try {
      const got = await runPreparedQaSummary(pp);
      rec.execution = got.execution;
      rec.adapterOutput = got.output;
      // The ablation's allowlist is exactly the visible question IDs; fallback uses the original deterministic snapshot.
      const allowed = new Set(d.visible.map((q) => q.id));
      const scoped =
        arm === 'B' && got.execution.effectiveMode === 'full-context'
          ? {
              ...pp,
              presentationLabels: new Map(
                [...pp.presentationLabels].filter(([id]) => allowed.has(id)),
              ),
              request: {
                ...pp.request,
                promptContext: {
                  ...d.packed,
                  context: {
                    ...d.packed.context,
                    sources: d.packed.context.sources.filter((s) => allowed.has(s.id)),
                  },
                },
              },
            }
          : pp;
      rec.bound = bind({
        output: got.output,
        prepared: scoped,
        execution: got.execution,
        analyzedAt: now.toISOString(),
      });
    } catch (e) {
      rec.error = String(e);
    }
    rec.componentMs = performance.now() - t0;
    rec.stamp = new Date().toISOString();
    for (const [key, file] of Object.entries({
      cgroupBytes: '/sys/fs/cgroup/memory.current',
      cpuStat: '/sys/fs/cgroup/cpu.stat',
    }))
      if (existsSync(file)) rec[key] = readFileSync(file, 'utf8').trim();
    save(id + '.json', rec);
    trials.push(rec);
    console.log(
      id,
      rec.http,
      rec.usage?.prompt_tokens,
      Math.round(rec.componentMs),
      rec.bound?.status,
    );
    if (!rep && rec.http !== 200) throw Error('Pilot transport failed; inspect saved run ' + id);
  }
  if (extended) {
    await run('meta6', 'A', 0);
    await run('meta6', 'B', 0);
    for (let rep = 1; rep <= 3; rep++) {
      const order = rep % 2 ? keys : [...keys].reverse();
      for (const [i, key] of order.entries()) {
        for (const arm of i % 2 ? ['A', 'B'] : ['B', 'A']) await run(key, arm, rep);
      }
    }
    expect(trials).toHaveLength(14);
  } else {
    await run('S100', 'A', 0);
    await run('S100', 'B', 0);
    for (let rep = 1; rep <= 5; rep++) {
      for (const key of rep % 2 ? keys : [...keys].reverse()) {
        for (const arm of (rep + (key === 'S6' ? 0 : 1)) % 2 ? ['A', 'B'] : ['B', 'A'])
          await run(key, arm, rep);
      }
    }
    expect(trials).toHaveLength(22);
  }
}, 750000);
