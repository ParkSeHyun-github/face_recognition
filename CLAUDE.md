# PoseFit — 프로젝트 개요

얼굴 인식 로그인 + 실시간 자세 분석 운동 피드백 웹 앱.

## 실행 방법

터미널 두 개를 열어서 각각 실행한다.

```bash
# 백엔드 (port 8000)
cd backend
source venv/bin/activate
python manage.py runserver

# 프론트엔드 (port 3000)
cd frontend
npm run dev
```

브라우저: `http://localhost:3000`

---

## 폴더 구조

```
001_opencv/
├── backend/        Django REST API 서버 (port 8000)
├── frontend/       React + Vite 클라이언트 (port 3000)
└── ubuntu-dev/     Docker 개발 환경 설정
```

---

## backend/

Django 5.2 / Python 3.11 / SQLite

```
backend/
├── config/                 Django 프로젝트 설정
│   ├── settings.py         CORS, CSRF, DB, 미디어 경로 설정
│   └── urls.py             루트 URL 라우터
│
├── accounts/               인증 앱 (얼굴 등록/로그인)
│   ├── views.py            페이지 뷰 + REST API 뷰
│   └── urls.py             /api/csrf/, /api/me/, /api/login/frame/ 등
│
├── workout/                운동 앱 (자세 분석/피드백/클립)
│   ├── views.py            운동 세션 API, 피드백 API, 클립 API
│   ├── urls.py             /api/workout/... 경로
│   ├── pose_analyzer.py    MediaPipe 기반 관절 각도 계산 + 점수 + 피드백
│   ├── pose_standards.json 운동별 이상적인 관절 각도 기준값
│   └── models.py           WorkoutSession, RepClip 모델
│
├── face_auth/              얼굴 인식 모듈
│   ├── detector.py         OpenCV Haar Cascade 얼굴 검출
│   ├── recognizer.py       LBPH 얼굴 인식
│   ├── trainer.py          얼굴 데이터로 모델 학습
│   └── database.py         유저 ID ↔ 이름 JSON DB
│
├── data/                   얼굴 샘플 이미지 + users.json
├── media/rep_clips/        운동 중 저장된 Rep 영상 클립
├── requirements.txt        pip 패키지 목록
└── venv/                   Python 가상환경 (Python 3.11)
```

### 주요 API 엔드포인트

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/csrf/` | CSRF 토큰 발급 |
| GET | `/api/me/` | 로그인 상태 확인 |
| GET | `/api/logout/` | 로그아웃 |
| GET | `/api/dashboard/` | 대시보드 데이터 |
| POST | `/api/login/frame/` | 얼굴 인식 로그인 (base64 프레임) |
| POST | `/api/register/start/` | 얼굴 등록 시작 |
| POST | `/api/register/frame/` | 얼굴 샘플 수집 |
| POST | `/api/register/finish/` | 모델 학습 완료 |
| POST | `/api/workout/start/` | 세트 시작 (운동 종목 선택) |
| POST | `/api/workout/frame/` | 프레임 분석 → 단계·점수·관절 피드백 반환 |
| POST | `/api/workout/finish/` | 세트 종료 + DB 저장 |
| GET  | `/api/workout/feedback/` | 피드백 데이터 (차트, 기록) |
| GET  | `/api/workout/clips/` | 클립 목록 |
| POST | `/api/workout/save_clip/` | Rep 영상 저장 |
| POST | `/api/workout/delete_clip/<id>/` | 클립 삭제 |

### pose_analyzer.py 구조

- `extract_angles(landmarks, exercise)` — 운동별 관절 각도 계산
- `detect_stage(angles, exercise)` — STANDING / GOING_DOWN / BOTTOM / GOING_UP 단계 판별
- `calculate_score(angles, exercise)` — BOTTOM 단계 각도 → 0~100점
- `get_angle_feedback(angles, exercise)` — 관절별 교정 피드백 문자열 생성
- `RepTracker` — 프레임마다 호출되는 rep 카운터 + 점수 누적기

### 지원 운동

| 종목 | 측정 관절 |
|------|-----------|
| 스쿼트 | 무릎, 엉덩이·허리 |
| 런지 | 앞 무릎, 뒷 무릎 |
| 플랭크 | 엉덩이·허리, 팔꿈치 |
| 오버헤드 프레스 | 팔꿈치, 어깨 |

---

## frontend/

React 18 + Vite + react-router-dom / Node.js

```
frontend/
├── index.html              Google Fonts, Chart.js CDN 포함
├── vite.config.js          port 3000, /api → :8000 proxy 설정
│
└── src/
    ├── main.jsx            React 앱 진입점
    ├── App.jsx             BrowserRouter + 라우트 정의, 인증 가드
    ├── api.js              백엔드 fetch 래퍼 (CSRF 자동 처리)
    ├── index.css           CSS 변수, 다크모드, 공통 버튼 스타일
    │
    ├── components/
    │   └── Header.jsx      공통 헤더 (로고, 유저명, 다크모드, 로그아웃)
    │
    └── pages/
        ├── LoginPage.jsx       얼굴 인식 로그인 (웹캠)
        ├── RegisterPage.jsx    얼굴 등록 (샘플 40장 수집)
        ├── DashboardPage.jsx   메인 메뉴 카드
        ├── WorkoutPage.jsx     운동 측정 (웹캠 + 실시간 분석 + 요약 모달)
        ├── FeedbackPage.jsx    피드백 차트 + 기록 테이블
        ├── ClipsPage.jsx       Rep 영상 클립 목록/삭제
        └── ManagePage.jsx      관리자 유저 관리
```

### 프론트-백 통신 방식

- Vite dev proxy: `/api/*` 요청을 `http://localhost:8000`으로 전달
- 인증: Django 세션 쿠키 (`credentials: 'include'`)
- CSRF: 요청 시 `csrftoken` 쿠키를 `X-CSRFToken` 헤더에 자동 포함 (`api.js`)
- 미인증 시 자동으로 `/login`으로 이동 (`RequireAuth` 컴포넌트)

### WorkoutPage 핵심 흐름

1. 웹캠 스트림 → 200ms마다 canvas에 그려서 base64 인코딩
2. `/api/workout/frame/` 호출 → 단계(stage), 점수(score), 관절 피드백(feedback) 수신
3. GOING_DOWN 진입 시 MediaRecorder로 Rep 녹화 시작
4. Rep 완료(score != null) 시 녹화 중단 + `/api/workout/save_clip/` 업로드
5. 세트 종료 후 요약 모달: Rep별 점수 + 관절 교정 피드백 + 영상 저장 여부 선택

---

## 분리 구조 요약

| 항목 | 백엔드 | 프론트엔드 |
|------|--------|------------|
| 포트 | 8000 | 3000 |
| 프레임워크 | Django 5.2 | React 18 + Vite |
| 역할 | API 제공, DB, 영상처리 | UI 렌더링, 웹캠, 라우팅 |
| 인증 | 세션 쿠키 | 쿠키 전달 (credentials: include) |
| 통신 | — | Vite proxy → localhost:8000 |
