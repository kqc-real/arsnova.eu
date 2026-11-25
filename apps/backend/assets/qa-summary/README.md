# Qwen-Tokenizer für die Q&A-Kurzfassung

`tokenizer.json.gz` und `tokenizer_config.json` stammen aus
[Qwen3-4B-Instruct-2507, Revision eb25fbe4f35f7147763bc24445679d1c00588d89](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507/tree/eb25fbe4f35f7147763bc24445679d1c00588d89).
Es gilt die beiliegende Apache-Lizenz 2.0.

| Quelldatei              | SHA-256 nach Dekompression                                         |
| ----------------------- | ------------------------------------------------------------------ |
| `tokenizer.json`        | `aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4` |
| `tokenizer_config.json` | `a5036bfb48523661f15d50c664e8dfc0e9b0b4c9a20eba3180782d52a1b94a8d` |

Vokabular, BPE-Merges und Chat-Rahmen entsprechen dem GGUF aus
`docker/open-weight-llm/model-manifest.json`. Der Loader lässt die
NFC-Normalisierung des Hugging-Face-Originals aus, um wie der
`qwen2`-Pretokenizer der gepinnten llama.cpp-Runtime die ursprüngliche
UTF-8-Darstellung zu zählen. Die Dateien liegen im App-Image. Das Backend
lädt sie beim ersten Einsatz lokal.
