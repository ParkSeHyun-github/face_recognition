# PoseFit

얼굴 인식 로그인 + 실시간 자세 분석 운동 피드백 웹 앱

## 기술 스택

| | 기술 |
|---|---|
| **프론트엔드** | React 18, Vite, react-router-dom |
| **백엔드** | Django 5.2, Python 3.11 |
| **포즈 분석** | MediaPipe Pose |
| **얼굴 인식** | OpenCV LBPH |
| **DB** | SQLite |

## 주요 기능

- **얼굴 인식 로그인** — 웹캠으로 얼굴을 등록하고 로그인
- **실시간 자세 분석** — 운동 중 MediaPipe로 관절 각도 측정 및 점수 산출
- **관절별 피드백** — 스쿼트, 런지, 플랭크, 오버헤드 프레스 각 관절 교정 메시지
- **스켈레톤 오버레이** — 운동 화면에 관절 연결선 실시간 표시
- **Rep 영상 클립** — Rep 단위로 운동 영상 자동 저장 및 관리
- **피드백 차트** — 일별 평균 점수, Rep별 점수 차트

## 프로젝트 구조

```
PoseFit/
├── backend/        Django REST API (port 8000)
├── frontend/       React + Vite 클라이언트 (port 3000)
├── start.sh        서버 동시 실행 스크립트
└── CLAUDE.md       상세 구조 문서
```

## 실행 방법

### 한 번에 실행
```bash
./start.sh
```

### 개별 실행
```bash
# 백엔드 (터미널 1)
cd backend
source venv/bin/activate
python manage.py runserver --noreload

# 프론트엔드 (터미널 2)
cd frontend
npm run dev
```

브라우저: `http://localhost:3000`

## 초기 설정

```bash
# 백엔드 패키지 설치
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate

# 프론트엔드 패키지 설치
cd frontend
npm install
```

## 관리자

관리자 페이지(`/manage`)에서 등록된 사용자를 관리할 수 있습니다.

기본 비밀번호: `admin1234` — `backend/accounts/views.py`의 `ADMIN_PASSWORD`에서 변경
