#face_recognition 기능 및 vitpose 모델을 활용한 pose estimate 구현, 목업 과정(?) 연습

1. 얼굴 인식 가능하도록 로그인 화면을 만듬
2. 처음에 회원 등록 및 오류 화면 확인 가능 
3. 얼굴이 인식되고 로그인이 완료되면 관리자페이지로 회원 삭제 가능
4. 관리자페이지 비밀번호는 admin1234, accounts/views.py 상단에 있습니다.
5. vitpose 모델을 활용해서 pose estimate 일부 구현한 사이트 만듬.

ADMIN_PASSWORD = 'admin1234'  # 이 부분 수정

