FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN pip3 install \
    django \
    opencv-python \
    mediapipe \
    numpy \
    Pillow \
    sounddevice

EXPOSE 8000

CMD ["python3", "manage.py", "runserver", "0.0.0.0:8000"]
