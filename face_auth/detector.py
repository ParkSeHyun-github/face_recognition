import cv2
import numpy as np
import os

PROTOTXT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "models", "deploy.prototxt")
CAFFE_PATH    = os.path.join(os.path.dirname(__file__), "..", "data", "models", "res10_300x300_ssd.caffemodel")
HAAR_PATH     = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"


class FaceDetector:
    def __init__(self):
        if os.path.exists(PROTOTXT_PATH) and os.path.exists(CAFFE_PATH):
            self._net  = cv2.dnn.readNetFromCaffe(PROTOTXT_PATH, CAFFE_PATH)
            self._mode = "dnn"
        else:
            self._net  = cv2.CascadeClassifier(HAAR_PATH)
            self._mode = "haar"

    def detect(self, frame, conf_threshold=0.6):
        h, w = frame.shape[:2]
        if self._mode == "dnn":
            blob = cv2.dnn.blobFromImage(
                cv2.resize(frame, (300, 300)), 1.0,
                (300, 300), (104.0, 177.0, 123.0)
            )
            self._net.setInput(blob)
            detections = self._net.forward()
            faces = []
            for i in range(detections.shape[2]):
                conf = detections[0, 0, i, 2]
                if conf < conf_threshold:
                    continue
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                x1, y1, x2, y2 = box.astype(int)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                if x2 > x1 and y2 > y1:
                    faces.append((x1, y1, x2 - x1, y2 - y1))
            return faces
        else:
            small = cv2.resize(frame, (320, int(h * 320 / w)))
            gray  = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            raw   = self._net.detectMultiScale(gray, 1.2, 4, minSize=(40, 40))
            scale = w / 320
            if len(raw) == 0:
                return []
            return [(int(x*scale), int(y*scale), int(fw*scale), int(fh*scale))
                    for (x, y, fw, fh) in raw]

    def extract_face(self, gray, bbox, target_size=(200, 200)):
        x, y, w, h = bbox
        pad = int(min(w, h) * 0.08)
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(gray.shape[1], x + w + pad)
        y2 = min(gray.shape[0], y + h + pad)
        roi = gray[y1:y2, x1:x2]
        roi = cv2.resize(roi, target_size)
        # CLAHE: equalizeHist보다 자연스러운 명암 보정
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(roi)

    def draw_faces(self, frame, faces, label=None, color=(0, 255, 0)):
        for (x, y, w, h) in faces:
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
            if label:
                cv2.putText(frame, label, (x, max(y - 10, 20)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        return frame
