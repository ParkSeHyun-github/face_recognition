import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

export default function LoginPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('카메라를 준비하고 있습니다...');
  const [bbox, setBbox] = useState(null);
  const [matched, setMatched] = useState(false);
  const intervalRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // CSRF 쿠키 초기화
    api.csrf().catch(() => {});

    let stream;
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(s => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        setStatus('얼굴을 카메라에 보여주세요.');
        intervalRef.current = setInterval(sendFrame, 500);
      })
      .catch(() => setStatus('카메라 권한을 허용해 주세요.'));

    return () => {
      clearInterval(intervalRef.current);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function sendFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 320, 240);
    const image = canvas.toDataURL('image/jpeg', 0.7);
    try {
      const data = await api.loginFrame(image);
      if (!data) return;
      if (!data.ok) { setStatus(data.error); return; }
      setBbox(data.bbox);
      if (data.matched) {
        setMatched(true);
        setStatus(`환영합니다, ${data.username}님!`);
        clearInterval(intervalRef.current);
        setTimeout(() => navigate('/dashboard'), 1000);
      } else {
        setStatus(data.message || '얼굴을 인식할 수 없습니다.');
      }
    } catch (e) {
      setStatus('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.');
      clearInterval(intervalRef.current);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--white)', borderRadius: 12, padding: '40px 48px', width: 420, boxShadow: 'var(--shadow)', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '1.5rem', fontWeight: 700, marginBottom: 6 }}>
          <span style={{ color: 'var(--blue)' }}>Pose</span><span style={{ color: 'var(--text)' }}>Fit</span>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 24 }}>얼굴 인식으로 로그인</p>

        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
          <video ref={videoRef} autoPlay playsInline width={320} height={240} style={{ borderRadius: 8, display: 'block', background: '#000' }} />
          {bbox && (
            <div style={{
              position: 'absolute',
              left: bbox[0], top: bbox[1],
              width: bbox[2], height: bbox[3],
              border: `2px solid ${matched ? 'var(--green)' : 'var(--blue)'}`,
              borderRadius: 4, pointerEvents: 'none',
            }} />
          )}
        </div>
        <canvas ref={canvasRef} width={320} height={240} style={{ display: 'none' }} />

        <p style={{
          fontSize: '0.9rem',
          color: matched ? 'var(--green)' : 'var(--text-secondary)',
          fontWeight: matched ? 600 : 400,
          marginBottom: 24,
        }}>{status}</p>

        <Link to="/register" style={{ fontSize: '0.875rem', color: 'var(--blue)' }}>
          처음이신가요? 얼굴 등록 →
        </Link>
      </div>
    </div>
  );
}
