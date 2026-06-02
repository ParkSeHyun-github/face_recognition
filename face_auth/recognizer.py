import cv2
import os
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "models", "lbph_model.yml")


class FaceRecognizer:
    CONFIDENCE_THRESHOLD = 52  # 낮을수록 더 엄격 (LBPH distance)

    def __init__(self):
        self.model = cv2.face.LBPHFaceRecognizer_create(
            radius=2, neighbors=8, grid_x=8, grid_y=8,
            threshold=self.CONFIDENCE_THRESHOLD,
        )
        self._trained = False
        if os.path.exists(MODEL_PATH):
            self.model.read(MODEL_PATH)
            self._trained = True

    def train(self, faces: list, labels: list):
        if not faces:
            raise ValueError("No face samples provided.")
        augmented_faces, augmented_labels = [], []
        for face, label in zip(faces, labels):
            arr = np.array(face, dtype=np.uint8)
            augmented_faces.append(arr)
            augmented_labels.append(label)
            # 밝기/대비 증강으로 다양한 조명 조건 학습
            for alpha, beta in [(1.2, 10), (0.85, -10), (1.0, 20)]:
                aug = cv2.convertScaleAbs(arr, alpha=alpha, beta=beta)
                augmented_faces.append(aug)
                augmented_labels.append(label)

        self.model.train(
            [np.array(f, dtype=np.uint8) for f in augmented_faces],
            np.array(augmented_labels, dtype=np.int32),
        )
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        self.model.save(MODEL_PATH)
        self._trained = True

    def predict(self, face_roi):
        """Return (user_id, confidence). user_id == -1 if unknown."""
        if not self._trained:
            return -1, 0.0
        face_arr = np.array(face_roi, dtype=np.uint8)
        label, confidence = self.model.predict(face_arr)
        if confidence > self.CONFIDENCE_THRESHOLD:
            return -1, confidence
        return label, confidence

    @property
    def is_trained(self):
        return self._trained
