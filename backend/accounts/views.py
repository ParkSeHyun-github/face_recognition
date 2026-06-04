import base64
import json
import os
import numpy as np
import cv2

from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie
from django.conf import settings
from django.middleware.csrf import get_token

from face_auth.detector import FaceDetector
from face_auth.recognizer import FaceRecognizer
from face_auth import database, trainer

FACES_DIR = settings.FACE_DATA_DIR / 'faces'
SAMPLES_NEEDED = 40

detector = FaceDetector()
recognizer = FaceRecognizer()


def _decode_frame(data_url: str):
    """base64 data URL → numpy BGR 이미지"""
    header, encoded = data_url.split(',', 1)
    img_bytes = base64.b64decode(encoded)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


ADMIN_PASSWORD = 'admin1234'  # 실제 서비스에서는 환경변수로 관리

# ── API 뷰 ────────────────────────────────────────────────

@require_POST
def api_register_start(request):
    data = json.loads(request.body)
    username = data.get('username', '').strip()
    if not username:
        return JsonResponse({'ok': False, 'error': '이름을 입력하세요.'})

    user_id = database.next_user_id()
    database.register_user(user_id, username)
    FACES_DIR.mkdir(parents=True, exist_ok=True)

    request.session['reg_user_id'] = user_id
    request.session['reg_username'] = username
    request.session['reg_count'] = 0
    return JsonResponse({'ok': True, 'user_id': user_id})


@require_POST
def api_register_frame(request):
    data = json.loads(request.body)
    user_id = request.session.get('reg_user_id')
    count = request.session.get('reg_count', 0)

    if not user_id:
        return JsonResponse({'ok': False, 'error': '등록 세션이 없습니다.'})
    if count >= SAMPLES_NEEDED:
        return JsonResponse({'ok': True, 'count': count, 'done': True})

    frame = _decode_frame(data['image'])
    if frame is None:
        return JsonResponse({'ok': False, 'error': '이미지 디코딩 실패'})

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = detector.detect(frame)

    if len(faces) != 1:
        msg = '얼굴을 1개만 보여주세요.' if len(faces) > 1 else '얼굴을 정면으로 보여주세요.'
        bbox = list(map(int, faces[0])) if len(faces) == 1 else None
        return JsonResponse({'ok': True, 'count': count, 'done': False,
                             'warning': msg, 'bbox': bbox})

    x, y, w, h = faces[0]
    face_roi = detector.extract_face(gray, faces[0])
    path = FACES_DIR / f"{user_id}_{count:03d}.png"
    cv2.imwrite(str(path), face_roi)

    count += 1
    request.session['reg_count'] = count
    done = count >= SAMPLES_NEEDED
    return JsonResponse({'ok': True, 'count': count, 'done': done,
                         'bbox': [int(x), int(y), int(w), int(h)]})


@require_POST
def api_register_finish(request):
    user_id = request.session.get('reg_user_id')
    count = request.session.get('reg_count', 0)

    if not user_id or count < SAMPLES_NEEDED:
        return JsonResponse({'ok': False, 'error': '샘플이 부족합니다.'})

    n = trainer.retrain()
    global recognizer
    recognizer = FaceRecognizer()

    request.session.pop('reg_user_id', None)
    request.session.pop('reg_username', None)
    request.session.pop('reg_count', None)
    return JsonResponse({'ok': True, 'samples': n})


@ensure_csrf_cookie
def api_csrf(request):
    """CSRF 토큰 발급 — React 앱 진입 시 호출"""
    return JsonResponse({'ok': True, 'csrfToken': get_token(request)})


def api_me(request):
    """현재 로그인 상태 반환"""
    user_id = request.session.get('user_id')
    if not user_id:
        return JsonResponse({'ok': False, 'authenticated': False})
    username = request.session.get('username', '')
    return JsonResponse({'ok': True, 'authenticated': True,
                         'user_id': user_id, 'username': username})


def api_logout(request):
    """로그아웃"""
    request.session.flush()
    return JsonResponse({'ok': True})


def api_dashboard(request):
    """대시보드 데이터"""
    user_id = request.session.get('user_id')
    if not user_id:
        return JsonResponse({'ok': False, 'error': '로그인이 필요합니다.'}, status=401)
    username = database.get_username(user_id) or '알 수 없음'
    users = database.list_users()
    return JsonResponse({'ok': True, 'username': username,
                         'total_users': len(users)})


def api_manage(request):
    """관리자 — 유저 목록 (GET) / 비밀번호 인증 (POST)"""
    user_id = request.session.get('user_id')
    if not user_id:
        return JsonResponse({'ok': False, 'error': '로그인이 필요합니다.'}, status=401)

    if request.method == 'POST':
        import json as _json
        data = _json.loads(request.body)
        pw = data.get('password', '')
        if pw == ADMIN_PASSWORD:
            request.session['is_admin'] = True
            return JsonResponse({'ok': True, 'authenticated': True})
        return JsonResponse({'ok': False, 'error': '비밀번호가 틀렸습니다.'})

    if not request.session.get('is_admin'):
        return JsonResponse({'ok': True, 'authenticated': False, 'users': []})

    users = database.list_users()
    user_info = []
    for uid, name in users.items():
        count = len([f for f in FACES_DIR.glob(f"{uid}_*.png")]) if FACES_DIR.exists() else 0
        user_info.append({'id': uid, 'name': name, 'samples': count})
    return JsonResponse({'ok': True, 'authenticated': True, 'users': user_info})


@require_POST
def api_manage_delete(request, user_id):
    """관리자 — 유저 삭제"""
    if not request.session.get('is_admin'):
        return JsonResponse({'ok': False, 'error': '관리자 권한이 필요합니다.'}, status=403)

    name = database.get_username(user_id)
    if not name:
        return JsonResponse({'ok': False, 'error': '존재하지 않는 사용자입니다.'})

    database.delete_user(user_id)
    if FACES_DIR.exists():
        for f in FACES_DIR.glob(f"{user_id}_*.png"):
            f.unlink()
    trainer.retrain()
    global recognizer
    recognizer = FaceRecognizer()
    return JsonResponse({'ok': True, 'deleted': name})


@require_POST
def api_login_frame(request):
    data = json.loads(request.body)
    frame = _decode_frame(data['image'])
    if frame is None:
        return JsonResponse({'ok': False, 'error': '이미지 디코딩 실패'})

    if not recognizer.is_trained:
        return JsonResponse({'ok': False, 'error': '등록된 얼굴이 없습니다.'})

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = detector.detect(frame)

    if len(faces) != 1:
        msg = '얼굴을 1개만 보여주세요.' if len(faces) > 1 else '얼굴을 인식할 수 없습니다.'
        return JsonResponse({'ok': True, 'matched': False, 'message': msg, 'bbox': None})

    x, y, w, h = faces[0]
    bbox = [int(x), int(y), int(w), int(h)]
    face_roi = detector.extract_face(gray, faces[0])
    user_id, confidence = recognizer.predict(face_roi)

    if user_id == -1:
        return JsonResponse({'ok': True, 'matched': False,
                             'message': f'일치하는 얼굴이 없습니다. ({confidence:.1f})',
                             'bbox': bbox})

    username = database.get_username(user_id) or '알 수 없음'
    request.session['user_id'] = user_id
    request.session['username'] = username
    return JsonResponse({'ok': True, 'matched': True, 'bbox': bbox,
                         'username': username, 'confidence': round(confidence, 1)})
