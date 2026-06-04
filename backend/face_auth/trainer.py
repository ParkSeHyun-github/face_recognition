import os
import cv2
import numpy as np
from . import database
from .recognizer import FaceRecognizer

FACES_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "faces")


def collect_samples():
    faces, labels = [], []
    if not os.path.exists(FACES_DIR):
        return faces, labels
    for fname in sorted(os.listdir(FACES_DIR)):
        if not fname.endswith(".png"):
            continue
        user_id = int(fname.split("_")[0])
        img = cv2.imread(os.path.join(FACES_DIR, fname), cv2.IMREAD_GRAYSCALE)
        if img is not None:
            faces.append(img)
            labels.append(user_id)
    return faces, labels


def retrain():
    faces, labels = collect_samples()
    if not faces:
        return 0
    recognizer = FaceRecognizer()
    recognizer.train(faces, labels)
    return len(faces)
