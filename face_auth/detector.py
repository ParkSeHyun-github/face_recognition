import cv2
import numpy as np

HAAR_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"

# 탐지용 리사이즈 너비 (작을수록 빠름, 너무 작으면 정확도 저하)
DETECT_WIDTH = 320


class FaceDetector:
    def __init__(self, scale_factor=1.2, min_neighbors=4, min_size=(50, 50)):
        self.detector = cv2.CascadeClassifier(HAAR_CASCADE_PATH)
        self.scale_factor = scale_factor
        self.min_neighbors = min_neighbors
        self.min_size = min_size

        # 프레임 스킵: 탐지는 N프레임마다 1번만 실행
        self._skip = 3
        self._frame_idx = 0
        self._cached_faces = []
        self._cached_scale = 1.0

    def detect(self, frame):
        """매 _skip 프레임마다 탐지 실행, 그 사이엔 캐시 반환."""
        self._frame_idx += 1
        if self._frame_idx % self._skip != 0:
            return self._scale_faces(self._cached_faces, self._cached_scale)

        h, w = frame.shape[:2]
        scale = DETECT_WIDTH / w
        small = cv2.resize(frame, (DETECT_WIDTH, int(h * scale)))
        gray_small = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

        raw = self.detector.detectMultiScale(
            gray_small,
            scaleFactor=self.scale_factor,
            minNeighbors=self.min_neighbors,
            minSize=self.min_size,
        )
        self._cached_faces = raw if len(raw) > 0 else []
        self._cached_scale = 1.0 / scale
        return self._scale_faces(self._cached_faces, self._cached_scale)

    @staticmethod
    def _scale_faces(faces, scale):
        if len(faces) == 0:
            return []
        return [(int(x * scale), int(y * scale), int(w * scale), int(h * scale))
                for (x, y, w, h) in faces]

    def extract_face(self, gray, bbox, target_size=(200, 200)):
        """gray 이미지에서 얼굴 ROI 추출 (gray 재변환 없음)."""
        x, y, w, h = bbox
        face_roi = gray[y:y + h, x:x + w]
        face_roi = cv2.resize(face_roi, target_size)
        face_roi = cv2.equalizeHist(face_roi)
        return face_roi

    def draw_faces(self, frame, faces, label=None, color=(0, 255, 0)):
        for (x, y, w, h) in faces:
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
            if label:
                cv2.putText(
                    frame, label, (x, max(y - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2,
                )
        return frame
