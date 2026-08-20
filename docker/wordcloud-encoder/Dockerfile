# =============================================================================
# arsnova.eu – optionaler Word-Cloud-Encoder (Story 1.14c Stufe 1)
#
# Separates Python-Image, nicht der Node-App-Container.
# Modell: intfloat/multilingual-e5-small (Apache-2.0), ONNX über Xenova.
#
# Basisimage: Multi-Arch-Index python:3.12-slim-bookworm, geprüft 2026-08-15 via
#   docker buildx imagetools inspect python:3.12-slim-bookworm
# =============================================================================

FROM python:3.12-slim-bookworm@sha256:a116514e19457bcb7af7efe9c3dd0b9b71e85b317694e7882a1c52aa15a78134

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/tmp \
    WORD_CLOUD_ENCODER_SOCKET_PATH=/run/wordcloud-encoder/encoder.sock \
    WORD_CLOUD_ENCODER_MODEL_DIR=/models/e5-small \
    HF_HUB_DISABLE_TELEMETRY=1

RUN groupadd --gid 1000 encoder \
    && useradd --uid 1000 --gid 1000 --system --home-dir /tmp --no-create-home encoder \
    && mkdir -p /run/wordcloud-encoder /models/e5-small \
    && chown encoder:encoder /run/wordcloud-encoder /models/e5-small

COPY requirements.txt NOTICE ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && python - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id="Xenova/multilingual-e5-small",
    local_dir="/models/e5-small",
    allow_patterns=["onnx/model.onnx", "onnx/model_quantized.onnx", "tokenizer.json", "tokenizer_config.json", "config.json"],
)
PY
    && rm -rf /root/.cache/pip /tmp/huggingface /tmp/huggingface_hub \
    && chown -R encoder:encoder /models/e5-small

COPY --chown=encoder:encoder embed.py server.py healthcheck.py ./
RUN chmod 0755 server.py healthcheck.py embed.py

USER 1000:1000

HEALTHCHECK --interval=15s --timeout=3s --start-period=120s --retries=5 \
    CMD python /app/healthcheck.py

CMD ["python", "/app/server.py"]
