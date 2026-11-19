"""2C: Roharchive erstellen oder im Archiv reproduzierbare CSV-Tabellen auswerten."""
import argparse
import csv
import hashlib
import json
import re
from pathlib import Path
from statistics import median

study = Path(__file__).resolve().parents[1]
series_names = ('640', '1024', 'erweitert')
app_sha = '1d71bd9583954d5304e3d56ee2cc716196190a65'


def encode(value, *, sorted_keys=False):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), sort_keys=sorted_keys)


def sha(value):
    return hashlib.sha256(value.encode()).hexdigest()


def archive_path(series):
    folder = 'extended_experiments' if series == 'erweitert' else 'messreihe'
    return study / folder / f'rohdaten-{series}.jsonl'


def expected_run_ids(series, include_warmups=True):
    extended = series == 'erweitert'
    cases = ('long100', 'meta6') if extended else ('S6', 'S100')
    repetitions = 3 if extended else 5
    runs = {f'{series}-R{rep}-{case}-{arm}' for rep in range(1, repetitions + 1)
            for case in cases for arm in ('A', 'B')}
    if include_warmups:
        pilot_case = 'meta6' if extended else 'S100'
        runs.update(f'{series}-P0-{pilot_case}-{arm}' for arm in ('A', 'B'))
    return runs


def collect(scratch):
    for series in series_names:
        dest = archive_path(series)
        directory = scratch / ('measure-' + series)
        reports = {path.stem for path in directory.glob(f'{series}-[RP]*.json')}
        if reports != expected_run_ids(series):
            raise ValueError(f'{series}: fehlende oder unerwartete Aufträge')
        with dest.open('x') as out:
            for path in sorted(directory.glob('*.json')):
                out.write(encode({'file': path.name, 'data': json.loads(path.read_text())})+'\n')
            out.write(encode({'file':'image-id.txt','data':(directory/'image-id.txt').read_text().strip()})+'\n')


def load(path):
    rows = map(json.loads, path.read_text().splitlines())
    return {r['file']: r['data'] for r in rows}


def write_csv(dest, name, rows):
    with (dest / name).open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys(),lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)


def evaluate(dest):
    dest.mkdir(parents=True, exist_ok=True)
    raw = {s:load(archive_path(s)) for s in series_names}
    selected_model = json.loads((study.parents[3] / 'docker/open-weight-llm/model-manifest.json').read_text())
    reference_server = raw['640']['environment.json']['serverSha']
    audit = json.loads((study/'extended_experiments/pruefstufen.json').read_text())
    ratings = json.loads((study/'extended_experiments/inhaltsbewertung.json').read_text())
    rows, cases = [], []
    for series, files in raw.items():
        run_ids = {Path(name).stem for name in files if re.fullmatch(r'\w+-[PR]\d+-\w+-[AB]\.json', name)}
        # Das Teilarchiv der Zusatzversuche enthält nur die gewerteten Läufe.
        include_warmups = series != 'erweitert' or any('-P0-' in run for run in run_ids)
        assert run_ids == expected_run_ids(series, include_warmups)
        env = files['environment.json']
        assert env['release'] == app_sha and env['model']['sha256'] == selected_model['sha256']
        assert env['serverSha'] == reference_server
        assert files['image-id.txt'] == 'sha256:c66e63f53dc546974dbeeca01a025d53eb24aaa35dc0fb405d596f3d5a36ab79'
        for name, r in files.items():
            if not re.fullmatch(r'\w+-[PR]\d+-\w+-[AB]\.json',name):
                continue
            run = r['id']
            assert name == run + '.json'
            _, _, key, arm = run.split('-')
            fixture = files[f'fixture-{key}.json']
            assert sha(encode(fixture,sorted_keys=True)) == r['fixtureSha256']
            if series != 'erweitert':
                assert fixture == json.loads((study / "messreihe/eingaben" / f"{key}.json").read_text())
            req = files[f'request-{key}-{arm}.json']
            assert sha(encode(req)) == r['wireSha256']
            packed = files[f'context-{key}-A.json']
            texts = files[f'context-{key}-B.json']
            if arm == 'B':
                assert json.loads(req['messages'][2]['content']) == texts
            else:
                assert json.loads(req['messages'][2]['content']) == packed['context']
            validation = audit[run]
            final = r['bound']
            visible = {k:final[k] for k in ('statements','suggestedNextSteps','limitations')}
            visible_hash=sha(encode(visible,sorted_keys=True))
            elements = final['statements']+final['suggestedNextSteps']
            count = sum(any(i.startswith('qa-question:') for i in x['sourceIds']) for x in elements)
            d1 = 2 if count==len(elements) and count else int(bool(count) and count*2>=len(elements))
            rating=ratings[visible_hash]
            allowed = {q['id'] for q in texts} if arm=='B' and validation['actualMode']=='full-context' else {q['id'] for q in packed['context']['sources']}
            assert all(i in allowed for s in elements for i in s['sourceIds'])
            rows.append({
                'series': series,
                'run': run,
                'scenario': key,
                'arm': arm,
                'rep': r['rep'],
                'available': r['n'],
                'included': len(texts),
                'prompt': r['usage']['prompt_tokens'],
                'generated': r['usage']['completion_tokens'],
                'cache': r['timings']['cache_n'],
                'finish': r['finish'],
                'json': validation['json'],
                'schema': validation['schema'],
                'references': validation['appRefs'],
                'quality': validation['qualityGate'],
                'mode': validation['actualMode'],
                'fallback': (r['execution']['fallback'] or {}).get('reason'),
                'status': final['status'],
                'pack_ms': round(r['packMs'], 3),
                'ttft_ms': round(r['ttftMs'], 3),
                'prefill_ms': r['timings']['prompt_ms'],
                'decode_ms': r['timings']['predicted_ms'],
                'component_ms': round(r['componentMs'], 3),
                'cgroup_MiB': round(int(r['cgroupBytes']) / 2 ** 20, 2),
                'raw_sha': sha(r['rawContent']),
                'visible_sha': visible_hash,
                'D1': d1,
                'D2': rating['D2'],
                'D3': rating['D3'],
                'D4': rating['D4'],
                'D5': rating['D5'],
                'score': d1 + sum((rating[k] for k in ('D2', 'D3', 'D4', 'D5'))),
            })
            if r['rep']==1 and arm=='A':
                alls=[s for s in fixture['context']['sources'] if s['kind']=='qa-question']
                selected={q['id'] for q in texts}
                omitted=[s['id'] for s in alls if s['id'] not in selected]
                truncated=[s['id'] for s in packed['context']['sources'] if s['kind']=='qa-question' and s['content'].get('truncated')]
                cases.append({
                    'series': series,
                    'scenario': key,
                    'available': len(alls),
                    'selected': len(selected),
                    'selected_ids': '|'.join((q['id'] for q in texts)),
                    'omitted_ids': '|'.join(omitted),
                    'truncated_ids': '|'.join(truncated),
                    'estimated_input': packed['budget']['packedInputTokens'],
                })
    assert set(audit) == {row['run'] for row in rows}
    for key in ('S6','S100'):
        for arm in 'AB':
            f=f'request-{key}-{arm}.json'
            low,high=raw['640'][f].copy(),raw['1024'][f].copy()
            assert low.pop('max_tokens')==640 and high.pop('max_tokens')==1024 and low==high
    write_csv(dest,'einzelwerte.csv',rows)
    write_csv(dest,'fragenauswahl.csv',cases)
    pairs = []
    for row in rows:
        if row['series'] != '640' or not row['rep']:
            continue
        suffix = row['run'].removeprefix('640-')
        lower = raw['640'][f'640-{suffix}.json']
        higher = raw['1024'][f'1024-{suffix}.json']
        pairs.append({
            'paar': suffix,
            'rohtext_identisch': lower['rawContent'] == higher['rawContent'],
            'differenz_ms_1024_minus_640': round(higher['componentMs'] - lower['componentMs'], 3),
        })
    write_csv(dest, 'budgetpaare.csv', pairs)
    summary=[]
    for series,key,arm in sorted({(r['series'],r['scenario'],r['arm']) for r in rows}):
        g=[r for r in rows if (r['series'],r['scenario'],r['arm'])==(series,key,arm) and r['rep']]
        summary.append({
            'series': series,
            'scenario': key,
            'arm': arm,
            'n': len(g),
            'included': g[0]['included'],
            'prompt': g[0]['prompt'],
            'output_median': median((r['generated'] for r in g)),
            'ttft_ms': round(median((r['ttft_ms'] for r in g)), 1),
            'component_ms': round(median((r['component_ms'] for r in g)), 1),
            'min_ms': min((r['component_ms'] for r in g)),
            'max_ms': max((r['component_ms'] for r in g)),
            'raw_json': sum((r['json'] for r in g)),
            'accepted': sum((r['mode'] == 'full-context' for r in g)),
            'unique_raw': len({r['raw_sha'] for r in g}),
            'unique_final': len({r['visible_sha'] for r in g}),
            'score_min': min((r['score'] for r in g)),
            'score_max': max((r['score'] for r in g)),
        })
    write_csv(dest,'uebersicht.csv',summary)


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archivieren',type=Path,metavar='SCRATCH')
    parser.add_argument('--ausgabe',type=Path)
    args=parser.parse_args()
    if args.archivieren:
        collect(args.archivieren)
    if args.ausgabe:
        evaluate(args.ausgabe)
    if not (args.archivieren or args.ausgabe):
        parser.error('Aktion fehlt')
