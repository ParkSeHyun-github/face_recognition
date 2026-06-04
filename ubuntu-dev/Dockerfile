FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    wget \
    curl \
    git \
    vim \
    && rm -rf /var/lib/apt/lists/*

# Miniconda 설치 (ARM64)
RUN wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-aarch64.sh -O miniconda.sh && \
    bash miniconda.sh -b -p /opt/conda && \
    rm miniconda.sh

ENV PATH="/opt/conda/bin:$PATH"

# conda 초기화
RUN conda init bash

WORKDIR /workspace

CMD ["/bin/bash"]
