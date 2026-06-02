#face_recognition

1. 얼굴 인식 가능하도록 로그인 화면을 만듬
2. 처음에 회원 등록 및 오류 화면 확인 가능 
3. 얼굴이 인식되고 로그인이 완료되면 관리자페이지로 회원 삭제 가능
4. 관리자페이지 비밀번호는 admin1234, accounts/views.py 상단에 있습니다.

ADMIN_PASSWORD = 'admin1234'  # 이 부분 수정


항목	변경 전	변경 후
얼굴 탐지	Haar Cascade (오탐 많음)	DNN (Caffe SSD) - 딥러닝 기반, 훨씬 정확
전처리	equalizeHist	CLAHE - 조명 변화에 강함
학습 증강	3가지 밝기 변형	4가지 밝기 + 좌우 반전 추가
임계값	52~58	68 - 적절히 여유 있게
