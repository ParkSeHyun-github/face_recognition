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


# 관절 이름 → 한국어
_ANGLE_LABELS = {
    'knee_angle': '무릎',
    'hip_angle': '엉덩이·허리',
    'front_knee_angle': '앞 무릎',
    'back_knee_angle': '뒷 무릎',
    'elbow_angle': '팔꿈치',
    'shoulder_angle': '어깨',
}

# 운동·관절별 방향 피드백 (angle < min → too_low, angle > max → too_high)
_JOINT_FEEDBACK = {
    'squat': {
        'knee_angle': {
            'too_high': '무릎을 더 굽혀 주세요. 엉덩이가 무릎 높이 아래로 내려와야 합니다.',
            'too_low':  '무릎이 너무 많이 굽혀졌습니다. 무릎이 발끝을 너무 많이 넘기지 않도록 하세요.',
            'ok':       '무릎 각도가 좋습니다.',
        },
        'hip_angle': {
            'too_high': '엉덩이를 더 낮춰 주세요. 상체가 앞으로 더 숙여져야 합니다.',
            'too_low':  '상체를 좀 더 세워 주세요. 허리가 너무 굽어있습니다.',
            'ok':       '허리·엉덩이 각도가 좋습니다.',
        },
    },
    'lunge': {
        'front_knee_angle': {
            'too_high': '앞 무릎을 더 굽혀 주세요. 무릎이 발목 위에 오도록 내려가야 합니다.',
            'too_low':  '앞 무릎이 너무 굽혀졌습니다. 무릎이 발끝을 너무 넘어가지 않도록 하세요.',
            'ok':       '앞 무릎 각도가 좋습니다.',
        },
        'back_knee_angle': {
            'too_high': '뒷 무릎을 바닥 가까이 더 낮춰 주세요.',
            'too_low':  '뒷 무릎이 너무 굽혀졌습니다. 조금 덜 내려가도 됩니다.',
            'ok':       '뒷 무릎 각도가 좋습니다.',
        },
    },
    'plank': {
        'hip_angle': {
            'too_high': '엉덩이가 너무 올라갔습니다. 몸을 일직선으로 유지해 주세요.',
            'too_low':  '엉덩이가 처져 있습니다. 복부에 힘을 주고 엉덩이를 올려 주세요.',
            'ok':       '몸이 잘 일직선으로 유지되고 있습니다.',
        },
        'elbow_angle': {
            'too_high': '팔꿈치를 90°에 가깝게 굽혀 주세요.',
            'too_low':  '팔꿈치 각도가 너무 좁습니다. 손목이 팔꿈치 바로 아래에 오도록 하세요.',
            'ok':       '팔꿈치 각도가 좋습니다.',
        },
    },
    'overhead_press': {
        'elbow_angle': {
            'too_high': '팔꿈치 각도가 너무 큽니다.',
            'too_low':  '팔을 더 완전히 펴 주세요. 정점에서 팔이 곧게 펴져야 합니다.',
            'ok':       '팔 펴는 동작이 좋습니다.',
        },
        'shoulder_angle': {
            'too_high': '어깨 각도가 너무 큽니다.',
            'too_low':  '팔을 더 높이 올려 주세요. 팔이 귀 옆까지 올라와야 합니다.',
            'ok':       '어깨 올리는 동작이 좋습니다.',
        },
    },
}


def get_angle_feedback(angles, exercise):
    """각도별 구체적인 피드백 리스트 반환.
    반환값: [{'joint': '무릎', 'angle': 85.2, 'target': '70~100°', 'message': '...', 'status': 'ok'|'high'|'low'}, ...]
    """
    standard = STANDARDS.get(exercise, {})
    joint_fb = _JOINT_FEEDBACK.get(exercise, {})
    feedbacks = []

    for key, value in angles.items():
        if key not in standard:
            continue
        min_val = standard[key]['min']
        max_val = standard[key]['max']
        label = _ANGLE_LABELS.get(key, key)
        target_str = f'{min_val}~{max_val}°'

        if value > max_val:
            status = 'high'
            msg = joint_fb.get(key, {}).get('too_high', f'{label} 각도를 줄여 주세요.')
        elif value < min_val:
            status = 'low'
            msg = joint_fb.get(key, {}).get('too_low', f'{label} 각도를 늘려 주세요.')
        else:
            status = 'ok'
            msg = joint_fb.get(key, {}).get('ok', f'{label} 각도가 좋습니다.')

        feedbacks.append({
            'joint': label,
            'angle': round(value, 1),
            'target': target_str,
            'message': msg,
            'status': status,
        })

    return feedbacks


class RepTracker:
    """1회 동작(rep) 단계 추적 및 점수 산출"""

    def __init__(self, exercise):
        self.exercise = exercise
        self.stage = 'STANDING'
        self.bottom_angles = None
        self.rep_count = 0
        self.last_score = None
        self.all_rep_scores = []    # 세트 내 모든 rep 점수
        self.all_rep_feedbacks = [] # 세트 내 모든 rep 관절 피드백

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
        completed_feedback = None

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
                completed_feedback = get_angle_feedback(self.bottom_angles, self.exercise)
                self.last_score = completed_score
                self.all_rep_scores.append(completed_score)
                self.all_rep_feedbacks.append(completed_feedback)
                self.rep_count += 1
            self.stage = 'STANDING'
            self.bottom_angles = None

        return angles, self.stage, completed_score, completed_feedback
