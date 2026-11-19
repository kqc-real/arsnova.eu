"""Aus Rohmessungen reproduzierbare Tabellen erzeugen (Python 3, Standardbibliothek)."""
import argparse
import csv
import hashlib
import json
from pathlib import Path
from statistics import median

ARMS = ("auswahl", "alle")
MEASURES = ("inputTokens", "outputTokens", "requestMs", "ttftMs", "prefillMs", "decodeMs")


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def table(path, rows):
    with path.open("x", encoding="utf-8", newline="") as out:
        writer = csv.DictWriter(out, fieldnames=rows[0], lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def review_table(runs, review_file):
    reviews = load(review_file)["bewertungen"]
    results = []
    for arm in ARMS:
        review = reviews[arm]
        texts = {r["raw"] for r in runs if r["arm"] == arm and r["rep"] > 0}
        if {digest(text.encode()) for text in texts} != {review["rawSha256"]}:
            raise ValueError(f"{arm}: anderer Rohtext. Neue inhaltliche Bewertung erforderlich.")
        output = json.loads(texts.pop())["output"]
        for section in ("statements", "suggestedNextSteps"):
            assert len(output[section]) == len(review[section])
            for original, rating in zip(output[section], review[section]):
                assert original["text"] == rating["text"] and original["sourceIds"] == rating["sourceIds"]
        results.append({
            "arm": arm, "offeneAnliegenGesamt": 2,
            "davonSichtbar": len(review["sichtbareOffeneAnliegen"]),
            "davonErwaehnt": len(review["erwaehnteOffeneAnliegen"]),
            "davonAlsOffenErhalten": len(review["alsOffenErhalten"]),
            "zugangshuerdeErklaert": review["zugangshuerdeErklaert"], "frist": review["frist"],
            "aussagenGesamt": len(review["statements"]),
            "aussagenBelegt": sum(r["belegtOderPassenderVorschlag"] for r in review["statements"]),
            "vorschlaegeGesamt": len(review["suggestedNextSteps"]),
            "vorschlaegePassend": sum(r["belegtOderPassenderVorschlag"] for r in review["suggestedNextSteps"]),
        })
    return results


def analyze(source, target, review_file):
    requests = {a: source / f"request-{a}.json" for a in ARMS}
    hashes = {a: digest(path.read_bytes()) for a, path in requests.items()}
    visible = {}
    template = {}
    for arm, path in requests.items():
        body = load(path)
        visible[arm] = json.loads(body["messages"][2].pop("content"))
        ids = [q["id"] for q in visible[arm]]
        for section in ("statements", "suggestedNextSteps"):
            allowed = body["response_format"]["schema"]["properties"]["output"]["properties"]
            assert allowed[section]["items"]["properties"]["sourceIds"]["items"].pop("enum") == ids
        template[arm] = body
    assert template["auswahl"] == template["alle"]
    assert visible["alle"] == load(Path(__file__).with_name("fragen.json"))
    selected_ids = {q["id"] for q in visible["auswahl"]}
    assert visible["auswahl"] == [q for q in visible["alle"] if q["id"] in selected_ids]

    runs = [json.loads(line) for line in (source / "messungen.jsonl").read_text().splitlines()]
    expected = [(n, arm) for n, order in enumerate((ARMS, ARMS, ARMS[::-1], ARMS[::-1], ARMS)) for arm in order]
    assert [(r["rep"], r["arm"]) for r in runs] == expected, "Unvollständige Messreihe"
    validation = {item["id"]: item for item in load(source / "validierung.json")}
    assert set(validation) == {r["id"] for r in runs}
    preflight = load(source / "tokenvorpruefung.json")
    rows = []
    for run in runs:
        arm = run["arm"]
        assert "error" not in run and run["requestFileSha256"] == hashes[arm]
        usage = run["usage"]
        checks = validation[run["id"]]
        limit = template[arm]["max_tokens"]
        assert max(usage["prompt_tokens"], preflight[arm]) + limit + 128 <= 8192
        rows.append({
            "id": run["id"], "arm": arm, "rep": run["rep"],
            "sourceCount": len(visible[arm]), "inputTokens": usage["prompt_tokens"],
            "outputTokens": usage["completion_tokens"], "requestMs": run["requestMs"],
            "ttftMs": run["ttftMs"], "prefillMs": run["timings"]["prompt_ms"],
            "decodeMs": run["timings"]["predicted_ms"], "finish": run["finish"],
            "http": run["http"], "within90s": run["requestMs"] <= 90000,
            "json": checks["json"], "schema": checks["schema"], "ids": checks["ids"],
            "form": checks["form"], "rawSha256": digest(run["raw"].encode()),
        })
    grouped = []
    for arm in ARMS:
        measured = [r for r in rows if r["arm"] == arm and r["rep"] > 0]
        for metric in MEASURES:
            values = [r[metric] for r in measured]
            grouped.append({"arm": arm, "n": len(values), "metric": metric,
                            "min": min(values), "median": median(values), "max": max(values)})

    reviews = review_table(runs, review_file) if review_file else []
    target.mkdir()
    table(target / "einzelwerte.csv", rows)
    table(target / "uebersicht.csv", grouped)
    if reviews:
        table(target / "quellentreue.csv", reviews)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("rohdaten", type=Path)
    parser.add_argument("neues_tabellenverzeichnis", type=Path)
    parser.add_argument("--bewertung", type=Path, help="Vorliegende inhaltliche Bewertung anhand der Rohtexte prüfen")
    args = parser.parse_args()
    analyze(args.rohdaten, args.neues_tabellenverzeichnis, args.bewertung)
