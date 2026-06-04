#!/bin/bash

# 기존 서버 정리
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

# 백엔드
cd backend
source venv/bin/activate
python manage.py runserver --noreload &
cd ..

# 프론트엔드
cd frontend
npm run dev &
cd ..

# 두 서버 모두 종료하려면 Ctrl+C
trap "lsof -ti:8000,3000 | xargs kill -9 2>/dev/null" EXIT
wait
