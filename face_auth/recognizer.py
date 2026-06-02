import cv2
import os
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "models", "lbph_model.yml")
THRESHOLD  = 68


class FaceRecognizer:
    def __init__(self):
        self._model = cv2.face.LBPHFaceRecognizer_create(
            radius=1, neighbors=8, grid_x=8, grid_y=8, threshold=THRESHOLD)
        self._trained = False
        if os.path.exists(MODEL_PATH):
            self._model.read(MODEL_PATH)
            self._trained = True

    def train(self, faces, labels):
        aug_faces, aug_labels = [], []
        for face, label in zip(faces, labels):
            arr = np.array(face, dtype=np.uint8)
            aug_faces.append(arr)
            aug_labels.append(label)
            # 밝기/대비 증강 → 다양한 조명에 강해짐
            for alpha, beta in [(1.3, 15), (0.75, -15), (1.0, 25), (0.9, -5)]:
                aug_faces.append(cv2.convertScaleAbs(arr, alpha=alpha, beta=beta))
                aug_labels.append(label)
            # 좌우 반전 → 각도 변화에 강해짐
            aug_faces.append(cv2.flip(arr, 1))
            aug_labels.append(label)

        self._model.train(
            [np.array(f, dtype=np.uint8) for f in aug_faces],
            np.array(aug_labels, dtype=np.int32),
        )
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        self._model.save(MODEL_PATH)
        self._trained = True

    def predict(self, face_roi):
        if not self._trained:
            return -1, 0.0
        label, conf = self._model.predict(np.array(face_roi, dtype=np.uint8))
        if conf > THRESHOLD:
            return -1, float(conf)
        return label, float(conf)

    @property
    def is_trained(self):
        return self._trained
