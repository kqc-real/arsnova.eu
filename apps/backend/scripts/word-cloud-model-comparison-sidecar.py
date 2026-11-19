"""Benchmark adapter for issue 695. Run with the existing sidecar image."""
import json
import os
import platform
from pathlib import Path
import sys
import time

import embed
import server

CANDIDATE = os.environ["MODEL_COMPARISON_CANDIDATE"]
MODEL_ID, PREFIX, MAX_TOKENS = {
    "e5": ("intfloat/multilingual-e5-small", "query: ", 512),
    "minilm": ("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2", "", 128),
    "gemma": ("google/embeddinggemma-300m", "task: clustering | query: ", 2048),
}[CANDIDATE]

# Use the sidecar's ONNX loader, CPU provider and length-sorted batches.
embed.MODEL_ID = MODEL_ID
embed.E5_PREFIX = PREFIX
embed.MAX_SEQ_LENGTH = MAX_TOKENS
load_embedder = server.load_embedder
embed_items = server.embed_items


class GemmaEmbedder(embed.OnnxE5Embedder):
    def __init__(self, model_dir):
        super().__init__(model_dir)
        if set(self._input_names) != {"input_ids", "attention_mask"}:
            raise ValueError(f"Unexpected Gemma inputs: {self._input_names}")
        self._tokenizer.enable_padding(pad_id=0, pad_token="<pad>")
        weights = Path(model_dir) / "onnx" / "model_quantized.onnx_data"
        self.model_version += f"-{embed.file_digest(weights)}"

    def _embed_batch(self, texts):
        np = self._np
        encoded = self._tokenizer.encode_batch([f"{PREFIX}{text}" for text in texts])
        feeds = {
            "input_ids": np.asarray([item.ids for item in encoded], dtype=np.int64),
            "attention_mask": np.asarray([item.attention_mask for item in encoded], dtype=np.int64),
        }
        (vectors,) = self._session.run(["sentence_embedding"], feeds)
        if vectors.shape != (len(texts), 768) or not np.isfinite(vectors).all():
            raise ValueError(f"Invalid Gemma vectors: {vectors.shape}")
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        if (norms <= 1e-12).any():
            raise ValueError("Zero Gemma embedding")
        return (vectors / norms).astype(float).tolist()


def timed_load():
    start = time.perf_counter()
    model = (
        GemmaEmbedder(os.environ["WORD_CLOUD_ENCODER_MODEL_DIR"])
        if CANDIDATE == "gemma"
        else load_embedder()
    )
    elapsed = (time.perf_counter() - start) * 1000
    import numpy
    import onnxruntime
    import tokenizers

    print(json.dumps({
        "kind": "load",
        "ms": elapsed,
        "modelVersion": model.model_version,
        "arch": platform.machine(),
        "python": platform.python_version(),
        "numpy": numpy.__version__,
        "onnxruntime": onnxruntime.__version__,
        "tokenizers": tokenizers.__version__,
    }), flush=True)
    return model


def timed_embed(payload, embedder, lock):
    start = time.perf_counter()
    response = embed_items(payload, embedder, lock)
    print(json.dumps({
        "kind": "embed",
        "items": len(payload["items"]),
        "snapshotHash": payload["snapshotHash"],
        "ms": (time.perf_counter() - start) * 1000,
    }), flush=True)
    return response


if __name__ == "__main__":
    if sys.argv[1:] == ["--smoke"]:
        import math

        model = timed_load()
        vectors = model.embed([
            "Ja",
            "Combien d’observations faut-il pour obtenir un intervalle de confiance étroit ?",
        ])
        assert len(vectors) == 2
        assert all(len(vector) == 768 and all(map(math.isfinite, vector)) for vector in vectors)
        norms = [math.sqrt(sum(value * value for value in vector)) for vector in vectors]
        assert all(math.isclose(norm, 1, rel_tol=1e-5) for norm in norms)
        print(json.dumps({"kind": "smoke", "shape": [2, 768], "norms": norms}), flush=True)
    else:
        server.load_embedder = timed_load
        server.embed_items = timed_embed
        server.main()
