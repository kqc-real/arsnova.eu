#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
src=${STUDY_WORK:-"$repo/tmp/stichtag"}/release
sha=1d71bd9583954d5304e3d56ee2cc716196190a65
node_image=node:24-bookworm-slim@sha256:8cabefbd444809cf0e319b5831c65da1ea202200ca552a5e75fd7938a6f86658
gpu_image=sha256:c66e63f53dc546974dbeeca01a025d53eb24aaa35dc0fb405d596f3d5a36ab79
case ${1:-} in pack|measure) ;; *) echo 'Aufruf: starten.sh pack|measure NEUES_ERGEBNISVERZEICHNIS' >&2; exit 2;; esac
out=$(realpath -m "${2:?Neues Ergebnisverzeichnis angeben}")
test -x "$src/.study-node/node"
study="$here/../messreihe"
for f in apps/backend/src/lib/{moderationSummaryContext,moderationPromptContextPacking,qaSummaryQuality,openWeightLlmClient}.ts libs/shared-types/src/{moderation-prompt-context-fixtures,moderation-prompt-context,open-weight-llm,qa-summary-v2}.ts package-lock.json docker/open-weight-llm/model-manifest.json; do
  git -C "$repo" show "$sha:$f" | cmp - "$src/$f"
done
# Fixierte Request-Vorlage und Serverstarter für die lokale Inferenz.
(cd "$here/.." && sha256sum --quiet -c messreihe/SHA256SUMS)
mkdir "$out"
args=(--rm --network none --user "$(id -u):$(id -g)" --cpus 4 --memory 8g --memory-swap 8g
      --pids-limit 256 --cap-drop ALL --security-opt no-new-privileges
      -v "$src:/release" -v "$here:/design:ro" -v "$study:/vorlage:ro" -v "$out:/evidence"
      -v "$here/quellenauswahl.test.ts:/release/apps/backend/src/lib/topic2c.experiment.test.ts:ro"
      -w /release/apps/backend)
if [[ $1 == pack ]]; then
  docker run "${args[@]}" -e ONLY_PACK=1 "$node_image" node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 src/lib/topic2c.experiment.test.ts
else
  : "${GPU_DIR:?Absoluten Pfad zum vorhandenen GPU-Testverzeichnis angeben}"
  test -c /dev/dxg
  docker image inspect --format '{{.Id}}' "$gpu_image" > "$out/image-id.txt"
  docker run "${args[@]}" --device /dev/dxg -v /usr/lib/wsl/lib/libdxcore.so:/usr/lib/libdxcore.so:ro -v "$GPU_DIR:/gpu:ro"     -e SERIE=E-DIREKT12 "$gpu_image" timeout -k 10 875 python3 /vorlage/server.py
fi
