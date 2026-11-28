#!/usr/bin/env bash
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
sha=1d71bd9583954d5304e3d56ee2cc716196190a65
scratch=${STUDY_WORK:-"$repo/tmp/stichtag"}
src="$scratch/release"
image=node:24-bookworm-slim@sha256:8cabefbd444809cf0e319b5831c65da1ea202200ca552a5e75fd7938a6f86658
sdk=sha256:c66e63f53dc546974dbeeca01a025d53eb24aaa35dc0fb405d596f3d5a36ab79
common=(--rm --user "$(id -u):$(id -g)" --cpus 4 --memory 8g --memory-swap 8g --pids-limit 256 --cap-drop ALL --security-opt no-new-privileges)
mounts=(-v "$src:/release" -v "$here:/study:ro" -v "$here/qa-kurzfassung.test.ts:/release/apps/backend/src/lib/topic2c.experiment.test.ts:ro" -w /release/apps/backend)
mkdir -p "$scratch"
case ${1:-} in
 setup)
   test ! -e "$src"
   mkdir "$src"
   git -C "$repo" archive "$sha" | tar -xf - -C "$src"
   docker run "${common[@]}" -v "$src:/release" -w /release -e npm_config_cache=/tmp/npm "$image" sh -ec 'npm ci --ignore-scripts --no-audit --no-fund && node_modules/.bin/prisma generate && npm run build:libs && mkdir -p .study-node && cp /usr/local/bin/node .study-node/node' > "$scratch/setup.log" 2>&1 ;;
 kontrollen)
   out=${OUT:-"$scratch/kontrollen"}
   mkdir "$out"
   docker run "${common[@]}" --network none -v "$src:/release" -v "$scratch:/messung:ro" -v "$out:/evidence" -v "$here/../extended_experiments/quellenpruefung.test.ts:/release/apps/backend/src/lib/topic2c.kontrollen.test.ts:ro" -w /release/apps/backend "$image" node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 src/lib/topic2c.kontrollen.test.ts > "$out/kontrollen.log" 2>&1 ;;
 pack|measure)
   mode=$1
   series=${2:?640, 1024 oder erweitert}
   case "$series" in 640|1024|erweitert) ;; *) exit 2 ;; esac
   out=${OUT:-"$scratch/$mode-$series"}
   mkdir "$out"
   # Sicherstellen, dass der tatsächlich verwendete Quellcode dem Stichtag entspricht.
   for f in apps/backend/src/lib/{moderationSummaryContext,moderationPromptContextPacking,openWeightLlmClient,qaSummaryRuntimeAdapter,qaSummaryQuality,qaSummaryValidateV2}.ts libs/shared-types/src/moderation-prompt-context-fixtures.ts package-lock.json; do
     git -C "$repo" show "$sha:$f" | cmp - "$src/$f"
   done
   extra=(-v "$out:/evidence" -e EVIDENCE=/evidence -e "SERIE=$series")
   if [[ $mode = pack ]]; then
     docker run "${common[@]}" --network none "${mounts[@]}" "${extra[@]}" -e ONLY_PACK=1 "$image" node ../../node_modules/vitest/vitest.mjs run --maxWorkers=1 src/lib/topic2c.experiment.test.ts > "$out/pack.log" 2>&1
   else
     : "${GPU_DIR:?Absoluter Pfad zum vorhandenen WSL-GPU-Testverzeichnis}"
     test -c /dev/dxg
     docker image inspect --format '{{.Id}}' "$sdk" > "$out/image-id.txt"
     docker run "${common[@]}" --network none --device /dev/dxg -v /usr/lib/wsl/lib/libdxcore.so:/usr/lib/libdxcore.so:ro -v "$GPU_DIR:/gpu:ro" "${mounts[@]}" "${extra[@]}" "$sdk" timeout -k 10 900 python3 /study/server.py
   fi ;;
 *) echo 'Aufruf: versuch.sh setup | kontrollen | {pack|measure} {640|1024|erweitert}' >&2; exit 2 ;;
esac
