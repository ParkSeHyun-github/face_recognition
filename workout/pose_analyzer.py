import json
import numpy as np
import mediapipe as mp
from pathlib import Path

mp_pose = mp.solutions.pose

STANDARDS_PATH = Path(__file__).parent / 'pose_standards.json'
with open(STANDARDS_PATH) as f:
    STANDARDS = json.load(f)

# 운동별 단계 정의 (주요 관절 기준)
# STANDING → GOING_DOWN → BOTTOM → GOING_UP → STANDING (1회 완료)
STAGE_THRESHOLDS = {
    'squat': {
        'key_angle': 'knee_angle',
        'standing': (160, 180),
        'going_down': (100, 160),
        'bottom': (60, 100),
        'going_up': (100, 160),
    },
    'lunge': {
        'key_angle': 'front_knee_angle',
        'standing': (160, 180),
        'going_down': (100, 160),
        'bottom': (70, 100),
        'going_up': (100, 160),
    },
    'plank': {
        # 플랭크는 유지 동작 → HOLD 단계만 사용
        'key_angle': 'hip_angle',
        'standing': (0, 140),
        'going_down': (0, 140),
        'bottom': (155, 180),
        'going_up': (0, 140),
    },
    'overhead_press': {
        # 팔 내림(시작) → 올리는 중 → 팔 완전히 올림(TOP) → 내리는 중 → 팔 내림(1회 완료)
        'key_angle': 'elbow_angle',
        'standing': (60, 130),   # 팔 내린 상태
        'going_down': (130, 165), # 내리는 중 (going_up과 공유)
        'bottom': (165, 180),     # 팔 완전히 올린 상태 (TOP)
        'going_up': (130, 165),   # 올리는 중
    },
}


def calculate_angle(a, b, c):
    a, b, c = np.array(a), np.array(b), np.array(c)
    radians = np.arctan2(c[1] - b[1], c[0] - b[0]) - \
              np.arctan2(a[1] - b[1], a[0] - b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    return 360 - angle if angle > 180 else angle


def get_landmark(landmarks, name):
    lm = landmarks[mp_pose.PoseLandmark[name].value]
    return [lm.x, lm.y]


def extract_angles(landmarks, exercise):
    angles = {}

    if exercise == 'squat':
        angles['knee_angle'] = calculate_angle(
            get_landmark(landmarks, 'LEFT_HIP'),
            get_landmark(landmarks, 'LEFT_KNEE'),
            get_landmark(landmarks, 'LEFT_ANKLE'),
        )
        angles['hip_angle'] = calculate_angle(
            get_landmark(landmarks, 'LEFT_SHOULDER'),
            get_landmark(landmarks, 'LEFT_HIP'),
            get_landmark(landmarks, 'LEFT_KNEE'),
        )

    elif exercise == 'lunge':
        angles['front_knee_angle'] = calculate_angle(
            get_landmark(landmarks, 'LEFT_HIP'),
            get_landmark(landmarks, 'LEFT_KNEE'),
            get_landmark(landmarks, 'LEFT_ANKLE'),
        )
        angles['back_knee_angle'] = calculate_angle(
            get_landmark(landmarks, 'RIGHT_HIP'),
            get_landmark(landmarks, 'RIGHT_KNEE'),
            get_landmark(landmarks, 'RIGHT_ANKLE'),
        )

    elif exercise == 'plank':
        angles['hip_angle'] = calculate_angle(
            get_landmark(landmarks, 'LEFT_SHOULDER'),
            get_landmark(landmarks, 'LEFT_HIP'),
            get_landmark(landmarks, 'LEFT_ANKLE'),
        )
        angles['elbow_angle'] = calculate_angle(
            get_landmark(landmarks, 'LEFT_SHOULDER'),
            get_landmark(landmarks, 'LEFT_ELBOW'),
            get_landmark(landmarks, 'LEFT_WRIST'),
        )

    elif exercise == 'overhead_press':
        angles['elbow_angle'] = calculate_angle(
            get_landmark(landmarks, 'LEFT_SHOULDER'),
            get_landmark(landmarks, 'LEFT_ELBOW'),
            get_landmark(landmarks, 'LEFT_WRIST'),
        )
        angles['shoulder_angle'] = calculate_angle(
            get_landmark(landmarks, 'LEFT_ELBOW'),
            get_landmark(landmarks, 'LEFT_SHOULDER'),
            get_landmark(landmarks, 'LEFT_HIP'),
        )

    return angles


def detect_stage(angles, exercise):
    """현재 각도로 단계 판별"""
    threshold = STAGE_THRESHOLDS[exercise]
    key = threshold['key_angle']
    val = angles.get(key, 0)

    if threshold['bottom'][0] <= val <= threshold['bottom'][1]:
        return 'BOTTOM'
    elif threshold['going_down'][0] <= val <= threshold['going_down'][1]:
        return 'GOING_DOWN'
    elif threshold['standing'][0] <= val <= threshold['standing'][1]:
        return 'STANDING'
    return 'UNKNOWN'


def calculate_score(angles, exercise):
    """BOTTOM 단계 각도를 기준값과 비교해서 0~100점 산출"""
    standard = STANDARDS[exercise]
    scores = []

    for key, value in angles.items():
        if key not in standard:
            continue
        min_val = standard[key]['min']
        max_val = standard[key]['max']
        mid = (min_val + max_val) / 2
        tolerance = (max_val - min_val) / 2

        diff = abs(value - mid)
        score = max(0, 100 - (diff / tolerance) * 50) if tolerance > 0 else 100
        scores.append(score)

    return round(sum(scores) / len(scores), 1) if scores else 0.0


class RepTracker:
    """1회 동작(rep) 단계 추적 및 점수 산출"""

    def __init__(self, exercise):
        self.exercise = exercise
        self.stage = 'STANDING'
        self.bottom_angles = None
        self.rep_count = 0
        self.last_score = None
        self.all_rep_scores = []  # 세트 내 모든 rep 점수

    @property
    def set_avg_score(self):
        if not self.all_rep_scores:
            return 0.0
        return round(sum(self.all_rep_scores) / len(self.all_rep_scores), 1)

    def update(self, landmarks):
        """프레임마다 호출 → (angles, stage, score or None) 반환"""
        angles = extract_angles(landmarks, self.exercise)
        stage = detect_stage(angles, self.exercise)

        completed_score = None

        if self.stage == 'STANDING' and stage in ('GOING_DOWN', 'BOTTOM'):
            self.stage = 'GOING_DOWN'

        elif self.stage == 'GOING_DOWN' and stage == 'BOTTOM':
            self.stage = 'BOTTOM'
            self.bottom_angles = angles

        elif self.stage == 'BOTTOM' and stage in ('GOING_DOWN', 'STANDING'):
            self.stage = 'GOING_UP'

        elif self.stage == 'GOING_UP' and stage == 'STANDING':
            if self.bottom_angles:
                completed_score = calculate_score(self.bottom_angles, self.exercise)
                self.last_score = completed_score
                self.all_rep_scores.append(completed_score)
                self.rep_count += 1
            self.stage = 'STANDING'
            self.bottom_angles = None

        return angles, self.stage, completed_score
