"""Gepaarte Direktanfragen an den lokalen, isolierten llama-server."""
import hashlib
import json
import os
import time
import urllib.request
from pathlib import Path

OUT = Path('/evidence')
BASE = 'http://127.0.0.1:8080'
HEADERS = {'Authorization': 'Bearer ' + os.environ['STUDY_TOKEN'], 'Content-Type': 'application/json'}


def post(path, value):
    data = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
    request = urllib.request.Request(BASE + path, data=data, headers=HEADERS)
    return urllib.request.urlopen(request, timeout=90)


def token_count(body):
    with post('/apply-template', body) as response:
        prompt = json.load(response)['prompt']
    with post('/tokenize', {'content': prompt, 'add_special': True, 'parse_special': True}) as response:
        return len(json.load(response)['tokens'])


def measure(record, body):
    with post('/slots/0?action=erase', {}) as response:
        response.read()
    start = time.perf_counter()
    record['raw'] = ''
    saw_end = False
    with post('/v1/chat/completions', body) as response:
        record['http'] = response.status
        for line in response:
            if time.perf_counter() - start > 90:
                raise TimeoutError('90 Sekunden überschritten')
            if not line.startswith(b'data:'):
                continue
            event = line[5:].strip()
            if event == b'[DONE]':
                saw_end = True
                continue
            obj = json.loads(event)
            if obj.get('usage'):
                record['usage'] = obj['usage']
            if obj.get('timings'):
                record['timings'] = obj['timings']
            for choice in obj.get('choices', []):
                if choice.get('finish_reason'):
                    record['finish'] = choice['finish_reason']
                text = choice.get('delta', {}).get('content')
                if text:
                    record.setdefault('ttftMs', (time.perf_counter() - start) * 1000)
                    record['raw'] += text
    record['requestMs'] = (time.perf_counter() - start) * 1000
    record['cgroupBytesAfter'] = int(Path('/sys/fs/cgroup/memory.current').read_text())
    if not saw_end or not record.get('finish') or not record.get('usage'):
        raise ValueError('Unvollständiger HTTP-Stream')
    if record['usage']['prompt_tokens'] + body['max_tokens'] + 128 > 8192:
        raise ValueError('Kontextbudget überschritten')


def main():
    arms = ('auswahl', 'alle')
    requests = {arm: json.loads((OUT / f'request-{arm}.json').read_text()) for arm in arms}
    counts = {arm: token_count(body) for arm, body in requests.items()}
    with (OUT / 'tokenvorpruefung.json').open('x') as f:
        json.dump(counts, f)
    if any(count + requests[arm]['max_tokens'] + 128 > 8192 for arm, count in counts.items()):
        raise ValueError('Vollständiger Prompt mit Antwortreserve passt nicht ins Fenster')
    # Je ein Warm-up; anschließend jede Variante zweimal an erster und zweimal an zweiter Stelle.
    with (OUT / 'messungen.jsonl').open('x') as out:
        for rep, order in enumerate((arms, arms, arms[::-1], arms[::-1], arms)):
            for arm in order:
                record = {'id': f'E-DIREKT12-{rep}-{arm}', 'arm': arm, 'rep': rep}
                record['requestFileSha256'] = hashlib.sha256((OUT / f'request-{arm}.json').read_bytes()).hexdigest()
                try:
                    measure(record, requests[arm])
                except Exception as exc:
                    record['error'] = f'{type(exc).__name__}: {exc}'
                    raise
                finally:
                    out.write(json.dumps(record, ensure_ascii=False) + '\n')
                    out.flush()


if __name__ == '__main__':
    main()
