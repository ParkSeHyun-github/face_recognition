"""
얼굴 인식 로그인 독립 데모
  - Django / React 없이 웹캠만으로 동작 확인
  - venv 활성화 후 backend/ 디렉터리에서 실행:
      python face_auth_demo.py

키 조작:
  r  — 얼굴 등록 모드 시작 (이름 입력 후 Enter)
  ESC / q  — 종료
"""

import sys
import os
import cv2
import time

# backend 패키지 경로를 sys.path에 추가
sys.path.insert(0, os.path.dirname(__file__))

from face_auth.detector import FaceDetector
from face_auth.recognizer import FaceRecognizer
from face_auth import database, trainer

# ── 상수 ──────────────────────────────────────────────────
SAMPLES_NEEDED = 40
FACES_DIR = os.path.join(os.path.dirname(__file__), "data", "faces")

# ── 색상 (BGR) ─────────────────────────────────────────────
GREEN  = (0, 220, 80)
RED    = (0, 60, 220)
YELLOW = (0, 200, 220)
WHITE  = (255, 255, 255)
BLACK  = (0, 0, 0)
GRAY   = (160, 160, 160)


def put_kr(frame, text, pos, color=WHITE, scale=0.65, thickness=2):
    """OpenCV 텍스트 출력 (영문/숫자; 한글은 ASCII fallback)"""
    cv2.putText(frame, text, pos, cv2.FONT_HERSHEY_SIMPLEX,
                scale, BLACK, thickness + 2, cv2.LINE_AA)
    cv2.putText(frame, text, pos, cv2.FONT_HERSHEY_SIMPLEX,
                scale, color, thickness, cv2.LINE_AA)


def draw_bbox(frame, bbox, color, label=""):
    x, y, w, h = bbox
    cv2.rectangle(frame, (x, y), (x + w, y + h), color, 2)
    if label:
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(frame, (x, y - th - 10), (x + tw + 8, y), color, -1)
        cv2.putText(frame, label, (x + 4, y - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, BLACK, 2, cv2.LINE_AA)


def draw_hud(frame, mode, extra=""):
    h, w = frame.shape[:2]
    bar_h = 38
    cv2.rectangle(frame, (0, 0), (w, bar_h), (30, 30, 30), -1)

    mode_text = f"[{mode}]  r=register  q=quit"
    put_kr(frame, mode_text, (10, 26), WHITE, scale=0.55, thickness=1)
    if extra:
        put_kr(frame, extra, (10, h - 12), YELLOW, scale=0.55, thickness=1)


def register_mode(cap, detector, username):
    """웹캠으로 얼굴 샘플 40장을 수집하고 모델을 재학습."""
    user_id = database.next_user_id()
    database.register_user(user_id, username)
    os.makedirs(FACES_DIR, exist_ok=True)

    count = 0
    last_capture = 0
    CAPTURE_INTERVAL = 0.15  # 초

    print(f"[등록] '{username}' (id={user_id}) — 정면을 보여주세요. {SAMPLES_NEEDED}장 수집합니다.")

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = detector.detect(frame)

        progress = int((count / SAMPLES_NEEDED) * (w - 20))
        cv2.rectangle(frame, (10, h - 22), (w - 10, h - 8), GRAY, -1)
        cv2.rectangle(frame, (10, h - 22), (10 + progress, h - 8), GREEN, -1)

        if len(faces) == 1:
            now = time.time()
            if now - last_capture >= CAPTURE_INTERVAL:
                face_roi = detector.extract_face(gray, faces[0])
                path = os.path.join(FACES_DIR, f"{user_id}_{count:03d}.png")
                cv2.imwrite(path, face_roi)
                count += 1
                last_capture = now

            color = GREEN
            label = f"Collecting {count}/{SAMPLES_NEEDED}"
        else:
            color = YELLOW
            label = "Face not found" if len(faces) == 0 else "One face only"

        for f in faces:
            draw_bbox(frame, f, color, label)

        draw_hud(frame, "REGISTER", f"User: {username}  Samples: {count}/{SAMPLES_NEEDED}")
        cv2.imshow("FaceAuth Demo", frame)

        key = cv2.waitKey(1) & 0xFF
        if key in (27, ord('q')):
            # 등록 취소
            database.delete_user(user_id)
            print("[등록 취소]")
            return
        if count >= SAMPLES_NEEDED:
            break

    print("[학습 중...] 잠시 기다려 주세요.")
    n = trainer.retrain()
    print(f"[완료] '{username}' 등록 완료 (학습 샘플 {n}장)")


def login_mode(frame, detector, recognizer, gray):
    """단일 프레임에서 얼굴 인식 결과를 반환."""
    faces = detector.detect(frame)
    if len(faces) == 0:
        return None, None, "얼굴 인식 중..."
    if len(faces) > 1:
        return faces, None, "얼굴 1개만 보여주세요"

    face_roi = detector.extract_face(gray, faces[0])
    user_id, confidence = recognizer.predict(face_roi)

    if user_id == -1:
        return faces, None, f"미등록 (conf={confidence:.1f})"

    username = database.get_username(user_id) or "?"
    return faces, username, f"Login OK: {username}  conf={confidence:.1f}"


def main():
    detector  = FaceDetector()
    recognizer = FaceRecognizer()

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("[오류] 웹캠을 열 수 없습니다.")
        sys.exit(1)

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    print("=" * 50)
    print("  FaceAuth Demo")
    print("  r = 새 얼굴 등록  |  q / ESC = 종료")
    print("=" * 50)

    login_result = ""
    login_result_color = WHITE
    last_login_time = 0
    LOGIN_COOLDOWN = 2.0  # 초

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame = cv2.flip(frame, 1)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        now = time.time()
        if not recognizer.is_trained:
            draw_hud(frame, "LOGIN", "No registered users — press r to register")
        else:
            faces, username, msg = login_mode(frame, detector, recognizer, gray)

            # 인식 성공 시 쿨다운 동안 결과 고정
            if username:
                login_result = msg
                login_result_color = GREEN
                last_login_time = now
            elif now - last_login_time > LOGIN_COOLDOWN:
                login_result = msg
                login_result_color = WHITE if "중" in msg else YELLOW

            color = GREEN if username else (YELLOW if faces and len(faces) == 1 else RED)
            label = msg.split("conf=")[0].strip() if faces else ""

            if faces:
                for f in faces:
                    draw_bbox(frame, f, color, label)

            draw_hud(frame, "LOGIN", login_result)

        cv2.imshow("FaceAuth Demo", frame)
        key = cv2.waitKey(1) & 0xFF

        if key in (27, ord('q')):
            break

        if key == ord('r'):
            # 이름 입력을 터미널에서 받음
            cv2.destroyWindow("FaceAuth Demo")
            username_input = input("\n등록할 이름을 입력하세요: ").strip()
            if username_input:
                register_mode(cap, detector, username_input)
                recognizer = FaceRecognizer()  # 재학습된 모델 로드
            # 창 재오픈
            cv2.namedWindow("FaceAuth Demo")

    cap.release()
    cv2.destroyAllWindows()
    print("종료.")


if __name__ == "__main__":
    main()
