# =============================================================================
# arsnova.eu – optionaler spaCy-Sidecar (Story 1.14b)
#
# Separates Python-Image, nicht der Node-App-Container.
# Standard-Modelle: de/en (MIT), fr (LGPL-LR), es (GPL-3.0), jeweils 3.8.0.
# it_core_news_sm (CC BY-NC-SA 3.0) gehört nicht in dieses Default-Image.
# Lizenztexte: licenses/LGPL-LR.txt, licenses/GPL-3.0.txt. Image ist kein reines MIT.
#
# Basisimage: Multi-Arch-Index python:3.12-slim-bookworm, geprüft 2026-08-15 via
#   docker buildx imagetools inspect python:3.12-slim-bookworm
# =============================================================================

FROM python:3.12-slim-bookworm@sha256:a116514e19457bcb7af7efe9c3dd0b9b71e85b317694e7882a1c52aa15a78134

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/tmp \
    NLP_SOCKET_PATH=/run/spacy/nlp.sock

RUN groupadd --gid 1000 spacy \
    && useradd --uid 1000 --gid 1000 --system --home-dir /tmp --no-create-home spacy \
    && mkdir -p /run/spacy \
    && chown spacy:spacy /run/spacy

COPY requirements.txt NOTICE ./
COPY licenses ./licenses
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && rm -rf /root/.cache/pip

COPY --chown=spacy:spacy server.py healthcheck.py ./
RUN chmod 0755 server.py healthcheck.py

USER 1000:1000

HEALTHCHECK --interval=15s --timeout=3s --start-period=90s --retries=5 \
    CMD python /app/healthcheck.py

CMD ["python", "/app/server.py"]
