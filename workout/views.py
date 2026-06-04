import base64
import json
import uuid
import numpy as np
import cv2
import mediapipe as mp

from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.conf import settings

from .models import WorkoutSession, RepClip
from .pose_analyzer import RepTracker

mp_pose = mp.solutions.pose

# 세션별 RepTracker 인스턴스 관리 (user_id → tracker)
_trackers = {}
_pose_model = mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5)


def _decode_frame(data_url: str):
    header, encoded = data_url.split(',', 1)
    img_bytes = base64.b64decode(encoded)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


# ── API 뷰 ────────────────────────────────────────────────

@require_POST
def api_workout_start(request):
    """세트 시작 - 운동 종목 선택"""
    user_id = request.session.get('user_id')
    if not user_id:
        return JsonResponse({'ok': False, 'error': '로그인이 필요합니다.'})

    data = json.loads(request.body)
    exercise = data.get('exercise')
    if exercise not in ('squat', 'lunge', 'plank', 'overhead_press'):
        return JsonResponse({'ok': False, 'error': '올바른 운동을 선택하세요.'})

    _trackers[user_id] = RepTracker(exercise)
    request.session['current_exercise'] = exercise

    return JsonResponse({'ok': True, 'exercise': exercise})


@require_POST
def api_workout_frame(request):
    """프레임 분석 - 단계 + 점수 반환"""
    user_id = request.session.get('user_id')
    if not user_id or user_id not in _trackers:
        return JsonResponse({'ok': False, 'error': '세션이 없습니다.'})

    data = json.loads(request.body)
    frame = _decode_frame(data['image'])
    if frame is None:
        return JsonResponse({'ok': False, 'error': '이미지 디코딩 실패'})

    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = _pose_model.process(image_rgb)

    if not results.pose_landmarks:
        return JsonResponse({'ok': True, 'detected': False})

    tracker = _trackers[user_id]
    angles, stage, score, feedback = tracker.update(results.pose_landmarks.landmark)

    landmarks = [
        {'x': round(lm.x, 4), 'y': round(lm.y, 4), 'visibility': round(lm.visibility, 2)}
        for lm in results.pose_landmarks.landmark
    ]

    response = {
        'ok': True,
        'detected': True,
        'stage': stage,
        'rep_count': tracker.rep_count,
        'angles': {k: round(v, 1) for k, v in angles.items()},
        'score': None,
        'feedback': None,
        'landmarks': landmarks,
    }

    if score is not None:
        response['score'] = score
        response['last_score'] = score
        response['feedback'] = feedback

    return JsonResponse(response)


@require_POST
def api_workout_finish(request):
    """세트 종료 - DB 저장"""
    user_id = request.session.get('user_id')
    if not user_id or user_id not in _trackers:
        return JsonResponse({'ok': False, 'error': '세션이 없습니다.'})

    data = json.loads(request.body)
    set_number = data.get('set_number', 1)

    tracker = _trackers[user_id]
    exercise = tracker.exercise
    rep_scores = tracker.all_rep_scores
    score = tracker.set_avg_score
    username = request.session.get('username', '')

    WorkoutSession.objects.create(
        user_name=username,
        exercise=exercise,
        set_number=set_number,
        score=score,
        rep_scores=rep_scores,
    )

    del _trackers[user_id]
    request.session.pop('current_exercise', None)

    return JsonResponse({'ok': True, 'saved_score': score})


def api_feedback(request):
    """피드백 데이터 JSON API"""
    user_id = request.session.get('user_id')
    if not user_id:
        return JsonResponse({'ok': False, 'error': '로그인이 필요합니다.'}, status=401)

    from collections import defaultdict
    username = request.session.get('username', '')
    sessions = WorkoutSession.objects.filter(user_name=username).order_by('created_at')

    filter_date = request.GET.get('date', '')
    filter_exercise = request.GET.get('exercise', '')
    filtered = sessions
    if filter_date:
        filtered = filtered.filter(created_at__date=filter_date)
    if filter_exercise:
        filtered = filtered.filter(exercise=filter_exercise)

    exercises = ['squat', 'lunge', 'plank', 'overhead_press']
    chart_data = {}
    for ex in exercises:
        records = sessions.filter(exercise=ex)
        daily = defaultdict(list)
        for r in records:
            day = r.created_at.strftime('%Y-%m-%d')
            daily[day].append(r.score)
        chart_data[ex] = {
            'labels': list(daily.keys()),
            'scores': [round(sum(v) / len(v), 1) for v in daily.values()],
        }

    rep_chart = []
    for s in filtered.order_by('created_at'):
        if s.rep_scores:
            rep_chart.append({
                'label': f"{s.get_exercise_display()} {s.set_number}세트 ({s.created_at.strftime('%m/%d')})",
                'scores': s.rep_scores,
            })

    sessions_data = []
    for s in filtered.order_by('-created_at'):
        sessions_data.append({
            'id': s.id,
            'exercise': s.exercise,
            'exercise_display': s.get_exercise_display(),
            'set_number': s.set_number,
            'score': s.score,
            'rep_scores': s.rep_scores,
            'created_at': s.created_at.strftime('%Y-%m-%d %H:%M'),
        })

    date_list = [d.strftime('%Y-%m-%d') for d in sessions.dates('created_at', 'day', order='DESC')]

    return JsonResponse({
        'ok': True,
        'username': username,
        'sessions': sessions_data,
        'chart_data': chart_data,
        'rep_chart': rep_chart,
        'date_list': date_list,
    })


def api_clips(request):
    """클립 목록 JSON API"""
    user_id = request.session.get('user_id')
    if not user_id:
        return JsonResponse({'ok': False, 'error': '로그인이 필요합니다.'}, status=401)
    username = request.session.get('username', '')
    clips = RepClip.objects.filter(user_name=username).order_by('-created_at')
    clips_data = []
    for c in clips:
        clips_data.append({
            'id': c.id,
            'exercise': c.exercise,
            'exercise_display': dict(RepClip.EXERCISE_CHOICES).get(c.exercise, c.exercise),
            'rep_number': c.rep_number,
            'score': c.score,
            'video_url': c.video_file.url if c.video_file else None,
            'created_at': c.created_at.strftime('%Y-%m-%d %H:%M'),
        })
    return JsonResponse({'ok': True, 'clips': clips_data})



@require_POST
def api_save_clip(request):
    """Rep 클립 저장"""
    user_id = request.session.get('user_id')
    if not user_id:
        return JsonResponse({'ok': False, 'error': '로그인이 필요합니다.'})

    rep_number = request.POST.get('rep_number', 1)
    score = request.POST.get('score', 0)
    exercise = request.POST.get('exercise', '')
    video_file = request.FILES.get('video')

    if not video_file:
        return JsonResponse({'ok': False, 'error': '영상 파일이 없습니다.'})

    username = request.session.get('username', '')
    clip = RepClip.objects.create(
        user_name=username,
        exercise=exercise,
        rep_number=int(rep_number),
        score=float(score),
        video_file=video_file,
    )
    return JsonResponse({'ok': True, 'clip_id': clip.id})


@require_POST
def api_delete_clip(request, clip_id):
    """클립 삭제"""
    user_id = request.session.get('user_id')
    if not user_id:
        return JsonResponse({'ok': False, 'error': '로그인이 필요합니다.'})

    username = request.session.get('username', '')
    try:
        clip = RepClip.objects.get(id=clip_id, user_name=username)
        clip.video_file.delete(save=False)
        clip.delete()
        return JsonResponse({'ok': True})
    except RepClip.DoesNotExist:
        return JsonResponse({'ok': False, 'error': '클립을 찾을 수 없습니다.'})
