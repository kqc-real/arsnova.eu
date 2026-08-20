"""Embedding helpers for the private word-cloud encoder (Story 1.14c Stufe 1).

Production uses ONNX `intfloat/multilingual-e5-small`. Tests inject a stub so CI
does not download weights. Request texts are never logged.
"""

from __future__ import annotations

import hashlib
import math
import os
from pathlib import Path
from typing import Protocol, Sequence

MODEL_ID = "intfloat/multilingual-e5-small"
DEFAULT_MODEL_DIR = "/models/e5-small"
MAX_SEQ_LENGTH = 512
E5_PREFIX = "query: "
# CPU-Sidecar (1 vCPU / 2 GiB): nicht 500×512 in einem Forward.
EMBED_BATCH_SIZE = 16


class Embedder(Protocol):
    model_id: str
    model_version: str

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        ...


def _l2_normalize(values: Sequence[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in values))
    if norm == 0:
        return list(values)
    return [value / norm for value in values]


def stub_vector_for_text(text: str) -> list[float]:
    """Geometric stand-in used only when the ONNX weights are absent."""
    normalized = text.lower()
    if any(
        token in normalized
        for token in ("kapitel 4", "klausur", "pruefung", "chapter 4", "exam", "test")
    ):
        jitter = 0.08 if "relevant" in normalized else 0.12 if "need" in normalized or "brauchen" in normalized else 0.0
        return _l2_normalize([1.0, jitter, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0])
    if any(token in normalized for token in ("folie", "slide", "moodle")):
        return _l2_normalize([0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0])
    if any(token in normalized for token in ("beamer", "haenger", "projector")):
        return _l2_normalize([0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0])
    digest = hashlib.sha256(normalized.encode("utf-8")).digest()
    raw = [((digest[index] / 255.0) * 2) - 1 for index in range(8)]
    return _l2_normalize(raw)


class StubEmbedder:
    def __init__(self) -> None:
        self.model_id = f"{MODEL_ID}-stub"
        self.model_version = f"{MODEL_ID}-stub@none"

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        return [stub_vector_for_text(text) for text in texts]


def file_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()[:16]


class OnnxE5Embedder:
    def __init__(self, model_dir: str) -> None:
        import numpy as np
        import onnxruntime as ort
        from tokenizers import Tokenizer

        root = Path(model_dir)
        quantized = root / "onnx" / "model_quantized.onnx"
        full = root / "onnx" / "model.onnx"
        onnx_path = quantized if quantized.is_file() else full if full.is_file() else root / "model.onnx"
        if not onnx_path.is_file():
            raise FileNotFoundError(str(onnx_path))
        tokenizer_path = root / "tokenizer.json"
        if not tokenizer_path.is_file():
            raise FileNotFoundError(str(tokenizer_path))

        self._np = np
        self._session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        self._tokenizer = Tokenizer.from_file(str(tokenizer_path))
        self._tokenizer.enable_truncation(max_length=MAX_SEQ_LENGTH)
        # Pad to the longest sequence in the batch, not 512. Q&A items are short;
        # fixed 512-padding made 500 CPU embeddings miss WORD_CLOUD_ENCODER_TIMEOUT_MS.
        self._tokenizer.enable_padding()
        self._input_names = [item.name for item in self._session.get_inputs()]
        self.model_id = MODEL_ID
        self.model_version = f"{MODEL_ID}@sha256:{file_digest(onnx_path)}"

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors: list[list[float]] = []
        for start in range(0, len(texts), EMBED_BATCH_SIZE):
            vectors.extend(self._embed_batch(texts[start : start + EMBED_BATCH_SIZE]))
        return vectors

    def _embed_batch(self, texts: Sequence[str]) -> list[list[float]]:
        prefixed = [f"{E5_PREFIX}{text}" for text in texts]
        encoded = self._tokenizer.encode_batch(prefixed)
        input_ids = self._np.asarray([item.ids for item in encoded], dtype=self._np.int64)
        attention_mask = self._np.asarray([item.attention_mask for item in encoded], dtype=self._np.int64)
        feeds: dict[str, object] = {}
        if "input_ids" in self._input_names:
            feeds["input_ids"] = input_ids
        if "attention_mask" in self._input_names:
            feeds["attention_mask"] = attention_mask
        if "token_type_ids" in self._input_names:
            feeds["token_type_ids"] = self._np.zeros_like(input_ids)
        outputs = self._session.run(None, feeds)
        hidden = self._np.asarray(outputs[0])
        if hidden.ndim == 3:
            mask = attention_mask.astype(self._np.float32)[:, :, None]
            summed = (hidden * mask).sum(axis=1)
            counts = self._np.clip(mask.sum(axis=1), 1e-9, None)
            pooled = summed / counts
        else:
            pooled = hidden
        norms = self._np.clip(self._np.linalg.norm(pooled, axis=1, keepdims=True), 1e-12, None)
        normalized = pooled / norms
        return normalized.astype(float).tolist()


def load_embedder(model_dir: str | None = None, allow_stub: bool = False) -> Embedder:
    configured = (model_dir or os.environ.get("WORD_CLOUD_ENCODER_MODEL_DIR") or DEFAULT_MODEL_DIR).strip()
    stub_allowed = allow_stub or os.environ.get("WORD_CLOUD_ENCODER_ALLOW_STUB") == "true"
    try:
        return OnnxE5Embedder(configured)
    except Exception:
        if stub_allowed:
            return StubEmbedder()
        raise
