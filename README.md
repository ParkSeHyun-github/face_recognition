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

### Docker (권장)
```bash
docker-compose up --build
```

### 로컬 — 한 번에 실행
```bash
./start.sh
```

### 로컬 — 개별 실행
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
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate

# 프론트엔드 패키지 설치
cd frontend
npm install
```

## 얼굴 인식 단독 데모 (face_auth_demo.py)

Django / React 없이 웹캠만으로 얼굴 등록·인식을 바로 확인할 수 있는 독립 스크립트입니다.

### 설치 (최초 1회)

```bash
cd backend

# venv 생성
python -m venv venv

# venv 활성화
# macOS/Linux
source venv/bin/activate
# Windows
venv\Scripts\activate

# 데모에 필요한 패키지만 설치 (mediapipe 불필요)
pip install opencv-python opencv-contrib-python numpy
```

### 실행

```bash
python face_auth_demo.py
```

### 화면 안내

| 상태 | 박스 색상 | 표시 내용 |
|------|-----------|-----------|
| 얼굴 없음 | — | "얼굴 인식 중..." |
| 미등록 얼굴 | 노란색 | confidence 값 |
| 인식 성공 | 초록색 | 이름 + confidence |
| 얼굴 2개 이상 | 빨간색 | 경고 문구 |

### 키 조작

| 키 | 동작 |
|----|------|
| `r` | 얼굴 등록 (터미널에서 이름 입력 → 샘플 40장 자동 수집 → 모델 재학습) |
| `q` / `ESC` | 종료 |

> 기존 웹 앱에서 등록한 얼굴(`data/faces/`, `data/models/lbph_model.yml`)을 그대로 사용하므로 웹에서 등록한 사용자를 바로 인식 테스트할 수 있습니다.

## 관리자

관리자 페이지(`/manage`)에서 등록된 사용자를 관리할 수 있습니다.

기본 비밀번호: `admin1234` — `backend/accounts/views.py`의 `ADMIN_PASSWORD`에서 변경
