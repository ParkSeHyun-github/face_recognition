"""Rebuild the recognition model from saved face images."""
import os
import cv2
import numpy as np
from . import database
from .recognizer import FaceRecognizer

FACES_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "faces")


def collect_samples():
    """Load all stored face images and return (faces, labels) lists."""
    faces, labels = [], []
    if not os.path.exists(FACES_DIR):
        return faces, labels
    for fname in os.listdir(FACES_DIR):
        if not fname.endswith(".png"):
            continue
        user_id = int(fname.split("_")[0])
        img = cv2.imread(os.path.join(FACES_DIR, fname), cv2.IMREAD_GRAYSCALE)
        if img is not None:
            faces.append(img)
            labels.append(user_id)
    return faces, labels


def retrain():
    """Retrain the LBPH model using all stored samples. Returns sample count."""
    faces, labels = collect_samples()
    if not faces:
        return 0
    recognizer = FaceRecognizer()
    recognizer.train(faces, labels)
    return len(faces)
