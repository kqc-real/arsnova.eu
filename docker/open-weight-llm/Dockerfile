# syntax=docker/dockerfile:1.7
# llama.cpp b10524, multi-arch manifest verified 2026-10-05.
FROM ghcr.io/ggml-org/llama.cpp:server-b10524@sha256:57e505f69c3a55fa5dd9c15fced47cff7a899f5b5b504ea93d75b2f401b87830 AS upstream

FROM upstream AS toolchain
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends cmake gcc-14 g++-14 libssl-dev ninja-build patch \
    && rm -rf /var/lib/apt/lists/*

FROM toolchain AS patched-server
WORKDIR /src
ADD --checksum=sha256:99df023cc0122cf26f6cde2befc79b0c3807f58e3d61c5fe40b9290a222ae8a3 \
    https://codeload.github.com/ggml-org/llama.cpp/tar.gz/9ee9fc04c136ef2ae729bfc60d18961b23c13ddf /tmp/llama.cpp.tar.gz
COPY cpu-decode-cancellation.patch targeted-inference-cancellation.patch /tmp/
RUN tar -xzf /tmp/llama.cpp.tar.gz --strip-components=1 \
    && patch --batch --forward -p1 < /tmp/cpu-decode-cancellation.patch \
    && patch --batch --forward -p1 < /tmp/targeted-inference-cancellation.patch \
    && cmake -G Ninja -B build \
       -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_COMPILER=gcc-14 -DCMAKE_CXX_COMPILER=g++-14 \
       -DBUILD_SHARED_LIBS=ON -DGGML_NATIVE=OFF -DGGML_BACKEND_DL=ON \
       -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF \
       -DLLAMA_BUILD_UI=OFF -DLLAMA_USE_PREBUILT_UI=OFF \
       -DLLAMA_BUILD_NUMBER=10524 -DLLAMA_BUILD_COMMIT=9ee9fc04c \
    && cmake --build build --target llama-server-impl --parallel 4 \
    && strip --strip-unneeded build/bin/libllama-server-impl.so

FROM upstream AS baseline

LABEL org.opencontainers.image.title="arsnova.eu private open-weight LLM runtime" \
      org.opencontainers.image.description="Pinned CPU-only llama-server for arsnova.eu runtime jobs" \
      org.opencontainers.image.source="https://github.com/kqc-real/arsnova.eu" \
      org.opencontainers.image.licenses="MIT"

USER root
RUN groupadd --gid 65532 arsnova-llm \
    && useradd --uid 65532 --gid 65532 --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin arsnova-llm \
    && mkdir -p /opt/arsnova /run/open-weight-llm \
    && chown 65532:65532 /run/open-weight-llm

COPY entrypoint.sh healthcheck.sh validate-bind.sh validate-token.sh model.sha256 /opt/arsnova/
RUN chmod 0555 /opt/arsnova/entrypoint.sh /opt/arsnova/healthcheck.sh /opt/arsnova/validate-bind.sh /opt/arsnova/validate-token.sh \
    && chmod 0444 /opt/arsnova/model.sha256

USER 65532:65532
ENTRYPOINT ["/opt/arsnova/entrypoint.sh"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=180s --retries=5 \
  CMD ["/opt/arsnova/healthcheck.sh"]

FROM baseline
# Keep the pinned upstream executable, libllama, and CPU backends.
COPY --from=patched-server /src/build/bin/libllama-server-impl.so /app/libllama-server-impl.so
