# GPU und Modellserver unter WSL einrichten

Zuerst vergleicht ein kleines HIP-Programm 262.144 Rechenergebnisse auf der GPU mit einer CPU-Referenz. Dann erhält der lokale Modellserver drei synthetische Fragen. Die Antwort muss gültiges JSON mit passenden Quellen-IDs sein. Außerdem muss das Serverprotokoll bestätigen, wie viele Modellschichten auf der GPU liefen. Die folgenden Befehle beginnen im Stammverzeichnis des Worktrees. [HIP-Test](../../../../scripts/experiments/wsl-gpu/hip-smoke.cpp) · [Modelltest](../../../../scripts/experiments/wsl-gpu/run-inference.py)

## Voraussetzungen

- AMD Radeon RX 9070 XT mit 16 GB Grafikspeicher (`gfx1201`), 32 GB Arbeitsspeicher.
- Windows 26H2, Build 26300.9711, vorhandener Treiber `32.0.31041.1004`. Ubuntu 26.04.1 unter WSL 2, Kernel `6.18.54.1-microsoft-standard-WSL2`.
- Linux-Container mit Docker Desktop 29.8.2, ROCm 7.14.1 und ROCDXG 1.2.1. Die GPU ist in WSL als `/dev/dxg` erreichbar.
- llama.cpp `b10524`, Qwen3-4B-Instruct-2507 Q4_K_M. Modellrevision, Dateigröße und SHA-256 stehen im [Modellmanifest](../../../../docker/open-weight-llm/model-manifest.json).

## Kompatibilitätstest wiederholen

Alle Befehle im WSL-Terminal aus dem Projektstamm ausführen. Auf dem eingerichteten Rechner können die Abschnitte zur Einrichtung übersprungen werden, wenn SDK-Image, Modell und kompilierter Server bereits vorliegen. Jeder Modelllauf schreibt in ein neues Verzeichnis unter `tmp/wsl-gpu-validation/`.

### 1. Linux-Umgebung einrichten

Das [Dockerfile](../../../../scripts/experiments/wsl-gpu/Dockerfile) installiert den ROCm-Compiler und die für diese GPU benötigten Bibliotheken im Testcontainer.

```bash
mkdir -p tmp/wsl-gpu-validation
docker build --progress plain --tag arsnova-wsl-gpu-sdk:7.14.1 \
  scripts/experiments/wsl-gpu \
  > tmp/wsl-gpu-validation/sdk-build.log 2>&1
```

### 2. GPU-Erkennung und Berechnung prüfen

Der Test meldet GPU, Architektur und die Anzahl der übereinstimmenden Rechenergebnisse.

```bash
docker run --rm --name arsnova-wsl-gpu-hip-check --user "$(id -u):$(id -g)" \
  --network none --cpus 4 --memory 8g --memory-swap 8g --pids-limit 256 \
  --cap-drop ALL --security-opt no-new-privileges --device /dev/dxg \
  --mount type=bind,src=/usr/lib/wsl/lib/libdxcore.so,dst=/usr/lib/libdxcore.so,readonly \
  --mount type=bind,src="$PWD/scripts/experiments/wsl-gpu",dst=/experiment,readonly \
  --mount type=bind,src="$PWD/tmp/wsl-gpu-validation",dst=/work \
  arsnova-wsl-gpu-sdk:7.14.1 bash -c '
    set -eu
    timeout --kill-after=5s 30s rocminfo > /work/rocminfo.log 2>&1
    timeout --kill-after=5s 120s hipcc --offload-arch=gfx1201 -O2 \
      /experiment/hip-smoke.cpp -o /work/hip-smoke > /work/hip-build.log 2>&1
    timeout --kill-after=5s 30s /work/hip-smoke > /work/hip-result.log 2>&1
    cat /work/hip-result.log
  '
```

### 3. Modellserver kompilieren und Modelldatei prüfen

Der Server wird mit HIP-Unterstützung für die RX 9070 XT gebaut. Der Modelldownload benötigt rund 2,5 GB.

```bash
curl --fail --location --retry 2 \
  https://codeload.github.com/ggml-org/llama.cpp/tar.gz/9ee9fc04c136ef2ae729bfc60d18961b23c13ddf \
  --output tmp/wsl-gpu-validation/llama-source.tar.gz
printf '%s  %s\n' 99df023cc0122cf26f6cde2befc79b0c3807f58e3d61c5fe40b9290a222ae8a3 tmp/wsl-gpu-validation/llama-source.tar.gz | sha256sum -c -
mkdir -p tmp/wsl-gpu-validation/llama.cpp
tar -xzf tmp/wsl-gpu-validation/llama-source.tar.gz --strip-components=1 \
  -C tmp/wsl-gpu-validation/llama.cpp
docker run --rm --name arsnova-wsl-gpu-build --user "$(id -u):$(id -g)" \
  --network none --cpus 4 --memory 8g --memory-swap 8g --pids-limit 256 \
  --cap-drop ALL --security-opt no-new-privileges \
  --mount type=bind,src="$PWD/tmp/wsl-gpu-validation",dst=/work \
  arsnova-wsl-gpu-sdk:7.14.1 bash -c '
    set -eu
    export HIPCXX=/opt/rocm/core-7.14/lib/llvm/bin/clang
    timeout --kill-after=5s 90s cmake -S /work/llama.cpp \
      -B /work/llama.cpp/build -G Ninja -DGGML_HIP=ON \
      -DGPU_TARGETS=gfx1201 -DCMAKE_BUILD_TYPE=Release \
      -DGGML_NATIVE=OFF -DLLAMA_CURL=ON > /work/llama-configure.log 2>&1
    timeout --kill-after=10s 900s cmake --build /work/llama.cpp/build \
      --target llama-server --parallel 4 > /work/llama-build.log 2>&1
  '
```

```bash
curl --fail --location --retry 2 --max-time 900 \
  --output tmp/wsl-gpu-validation/Qwen3-4B-Instruct-2507-Q4_K_M.gguf \
  https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/a06e946bb6b655725eafa393f4a9745d460374c9/Qwen3-4B-Instruct-2507-Q4_K_M.gguf
python3 - <<'CHECK_MODEL'
import hashlib, json
from pathlib import Path
manifest = json.loads(Path('docker/open-weight-llm/model-manifest.json').read_text())
model = Path('tmp/wsl-gpu-validation') / manifest['filename']
assert model.stat().st_size == manifest['sizeBytes']
with model.open('rb') as stream:
    assert hashlib.file_digest(stream, 'sha256').hexdigest() == manifest['sha256']
print('PASS: model size and SHA-256 match the manifest')
CHECK_MODEL
```

### 4. Lokale Zusammenfassung ausführen

Der Container verwendet nur die lokale GPU und den Modellserver auf der Loopback-Adresse. Nach dem Lauf steht das Ergebnis in `$lauf/inferenz/result.json`, der GPU-Nachweis in `server.log` desselben Verzeichnisses.

```bash
lauf=$(mktemp -d "$PWD/tmp/wsl-gpu-validation/kompatibilitaet.XXXXXX")
docker run --rm --name arsnova-wsl-gpu-inference --user "$(id -u):$(id -g)" \
  -e LD_LIBRARY_PATH=/work/llama.cpp/build/bin:/opt/rocm/lib:/opt/rocm/core-7.14/lib --network none --cpus 4 --memory 8g --memory-swap 8g --pids-limit 256 \
  --cap-drop ALL --security-opt no-new-privileges --device /dev/dxg \
  --mount type=bind,src=/usr/lib/wsl/lib/libdxcore.so,dst=/usr/lib/libdxcore.so,readonly \
  --mount type=bind,src="$PWD/scripts/experiments/wsl-gpu",dst=/experiment,readonly \
  --mount type=bind,src="$PWD/tmp/wsl-gpu-validation",dst=/work \
  arsnova-wsl-gpu-sdk:7.14.1 \
  timeout --kill-after=10s 180s python3 /experiment/run-inference.py \
    --server /work/llama.cpp/build/bin/llama-server \
    --model /work/Qwen3-4B-Instruct-2507-Q4_K_M.gguf \
    --output "/work/${lauf##*/}/inferenz"
```
