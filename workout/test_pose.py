import cv2
import mediapipe as mp
from pose_analyzer import RepTracker

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

# 테스트할 운동 선택 (squat / lunge / plank / overhead_press)
EXERCISE = 'overhead_press'

tracker = RepTracker(EXERCISE)
cap = cv2.VideoCapture(0)

with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image.flags.writeable = False
        results = pose.process(image)
        image.flags.writeable = True
        image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        if results.pose_landmarks:
            landmarks = results.pose_landmarks.landmark
            angles, stage, score = tracker.update(landmarks)

            # 1회 완료 시 점수 출력
            if score is not None:
                print(f'[Rep {tracker.rep_count}] Score: {score}')

            # 현재 단계 표시
            stage_color = {'STANDING': (0, 255, 0), 'GOING_DOWN': (0, 255, 255),
                           'BOTTOM': (0, 0, 255), 'GOING_UP': (255, 165, 0)}.get(stage, (255, 255, 255))
            cv2.putText(image, f'Stage: {stage}', (10, 40),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, stage_color, 3)

            # Rep 횟수 + 마지막 점수
            cv2.putText(image, f'Reps: {tracker.rep_count}', (10, 80),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
            if tracker.last_score is not None:
                cv2.putText(image, f'Last Score: {tracker.last_score}', (10, 120),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)

            # 각도 표시
            y = 160
            for key, val in angles.items():
                cv2.putText(image, f'{key}: {int(val)}', (10, y),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
                y += 28

            cv2.putText(image, f'Exercise: {EXERCISE}', (10, image.shape[0] - 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)

            mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

        cv2.imshow('Pose Analyzer Test', image)

        if cv2.waitKey(10) & 0xFF == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()
