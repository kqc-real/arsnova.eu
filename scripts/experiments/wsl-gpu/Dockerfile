# Local compatibility experiment only; not used by application Compose or CI.
FROM ubuntu:26.04@sha256:c098726dd9b9733f3e885f8de0ef375206a311b0a317eadc40d347b1115fb944

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg cmake ninja-build g++-14 git python3 \
    pkg-config libcurl4-openssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN curl --fail --silent --show-error --location \
      https://repo.amd.com/rocm/packages-multi-arch/gpg/rocm.gpg \
      | gpg --dearmor -o /usr/share/keyrings/amdrocm.gpg \
    && printf '%s\n' \
      'deb [arch=amd64 signed-by=/usr/share/keyrings/amdrocm.gpg] https://repo.amd.com/rocm/packages-multi-arch/ubuntu2604 stable main' \
      > /etc/apt/sources.list.d/rocm.list \
    && printf '%s\n' 'Package: amdrocm*' 'Pin: version 7.14.1-0' 'Pin-Priority: 1001' \
      > /etc/apt/preferences.d/rocm-experiment \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
      amdrocm-runtime7.14=7.14.1-0 \
      amdrocm-runtime-dev7.14=7.14.1-0 \
      amdrocm-llvm7.14=7.14.1-0 \
      amdrocm-llvm-dev7.14=7.14.1-0 \
      amdrocm-blas7.14-gfx1201=7.14.1-0 \
      amdrocm-blas-dev7.14=7.14.1-0 \
      amdrocm-hipblas-common-dev7.14=7.14.1-0 \
    && rm -rf /var/lib/apt/lists/*

RUN curl --fail --silent --show-error --location \
      https://github.com/ROCm/librocdxg/releases/download/v1.2.1/rocdxg-roct_1.2.1_amd64.deb \
      -o /tmp/rocdxg.deb \
    && printf '%s\n' '7889eef45a1132ed2dde88d8ea1356bf791ec9c05802a18940bc81b970e850e0  /tmp/rocdxg.deb' \
      | sha256sum --check \
    && dpkg -i /tmp/rocdxg.deb \
    && rm /tmp/rocdxg.deb

ENV ROCM_PATH=/opt/rocm/core-7.14
ENV HIP_PATH=/opt/rocm/core-7.14
ENV HIP_PLATFORM=amd
ENV PATH=/opt/rocm/core-7.14/bin:/opt/rocm/core-7.14/lib/llvm/bin:${PATH}
ENV LD_LIBRARY_PATH=/opt/rocm/lib:/opt/rocm/core-7.14/lib
ENV CC=gcc-14
ENV CXX=g++-14
WORKDIR /work
