import base64
import json
import os
import numpy as np
import cv2

from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_http_methods
from django.views.decorators.csrf import ensure_csrf_cookie
from django.contrib import messages
from django.conf import settings

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


# ── 페이지 뷰 ──────────────────────────────────────────────

def home(request):
    if request.session.get('user_id'):
        return redirect('dashboard')
    return redirect('login')


def dashboard(request):
    user_id = request.session.get('user_id')
    if not user_id:
        return redirect('login')
    username = database.get_username(user_id) or '알 수 없음'
    users = database.list_users()
    return render(request, 'accounts/dashboard.html', {
        'username': username,
        'users': users,
    })


@ensure_csrf_cookie
def register_page(request):
    return render(request, 'accounts/register.html', {
        'samples_needed': SAMPLES_NEEDED,
    })


@ensure_csrf_cookie
def login_page(request):
    if request.session.get('user_id'):
        return redirect('dashboard')
    return render(request, 'accounts/login.html')


def logout_view(request):
    request.session.flush()
    return redirect('login')


# ── 관리자 페이지 ──────────────────────────────────────────

ADMIN_PASSWORD = 'admin1234'  # 실제 서비스에서는 환경변수로 관리


def manage_page(request):
    # 비밀번호 로그인 처리
    if request.method == 'POST':
        pw = request.POST.get('password', '')
        if pw == ADMIN_PASSWORD:
            request.session['is_admin'] = True
        else:
            messages.error(request, '비밀번호가 틀렸습니다.')

    if not request.session.get('is_admin'):
        return render(request, 'accounts/manage_login.html')

    users = database.list_users()
    # 각 유저의 샘플 수 계산
    user_info = {}
    for uid, name in users.items():
        count = len([f for f in FACES_DIR.glob(f"{uid}_*.png")]) if FACES_DIR.exists() else 0
        user_info[uid] = {'name': name, 'samples': count}

    return render(request, 'accounts/manage.html', {'user_info': user_info})


@require_POST
def manage_delete(request, user_id):
    if not request.session.get('is_admin'):
        return redirect('manage')

    name = database.get_username(user_id)
    if name:
        database.delete_user(user_id)
        if FACES_DIR.exists():
            for f in FACES_DIR.glob(f"{user_id}_*.png"):
                f.unlink()
        trainer.retrain()
        global recognizer
        recognizer = FaceRecognizer()
        messages.success(request, f"'{name}' 사용자가 삭제되었습니다.")
    else:
        messages.error(request, '존재하지 않는 사용자입니다.')

    return redirect('manage')


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
