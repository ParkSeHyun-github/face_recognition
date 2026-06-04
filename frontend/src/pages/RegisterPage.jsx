import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

const SAMPLES_NEEDED = 40;

export default function RegisterPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [step, setStep] = useState('input'); // input | capturing | done
  const [username, setUsername] = useState('');
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState('');
  const [bbox, setBbox] = useState(null);
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
      })
      .catch(() => setStatus('카메라 권한을 허용해 주세요.'));

    return () => {
      clearInterval(intervalRef.current);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function startRegister() {
    if (!username.trim()) { setStatus('이름을 입력해 주세요.'); return; }
    setStatus('연결 중...');
    try {
      const data = await api.registerStart(username.trim());
      if (!data?.ok) { setStatus(data?.error || '서버 오류가 발생했습니다.'); return; }
      setStep('capturing');
      setStatus('얼굴을 카메라에 보여주세요.');
      intervalRef.current = setInterval(captureFrame, 300);
    } catch (e) {
      setStatus('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.');
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 320, 240);
    const image = canvas.toDataURL('image/jpeg', 0.8);
    try {
      const data = await api.registerFrame(image);
      if (!data?.ok) return;
      setCount(data.count);
      if (data.bbox) setBbox(data.bbox);
      if (data.warning) setStatus(data.warning);
      else setStatus(`샘플 수집 중... ${data.count}/${SAMPLES_NEEDED}`);
      if (data.done) {
        clearInterval(intervalRef.current);
        const res = await api.registerFinish();
        if (res?.ok) { setStep('done'); setStatus('등록 완료!'); }
      }
    } catch (e) { /* 프레임 오류는 무시하고 계속 수집 */ }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ background: 'var(--white)', borderRadius: 12, padding: '40px 48px', width: 420, boxShadow: 'var(--shadow)', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '1.5rem', fontWeight: 700, marginBottom: 6 }}>
          <span style={{ color: 'var(--blue)' }}>Pose</span><span style={{ color: 'var(--text)' }}>Fit</span>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 24 }}>얼굴 등록</p>

        {step === 'input' && (
          <>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="이름 입력"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.9rem', marginBottom: 12, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--text)' }}
              onKeyDown={e => e.key === 'Enter' && startRegister()}
            />
            <button className="btn-contained" style={{ width: '100%', padding: 11 }} onClick={startRegister}>
              등록 시작
            </button>
          </>
        )}

        {(step === 'capturing' || step === 'input') && (
          <div style={{ position: 'relative', display: 'inline-block', marginTop: 20, marginBottom: 16 }}>
            <video ref={videoRef} autoPlay playsInline width={320} height={240} style={{ borderRadius: 8, display: 'block', background: '#000' }} />
            {bbox && step === 'capturing' && (
              <div style={{
                position: 'absolute',
                left: bbox[0], top: bbox[1],
                width: bbox[2], height: bbox[3],
                border: '2px solid var(--green)', borderRadius: 4, pointerEvents: 'none',
              }} />
            )}
          </div>
        )}
        <canvas ref={canvasRef} width={320} height={240} style={{ display: 'none' }} />

        {step === 'capturing' && (
          <>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 0', marginBottom: 12 }}>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(count / SAMPLES_NEEDED) * 100}%`, background: 'var(--blue)', transition: 'width .3s' }} />
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 6 }}>{count}/{SAMPLES_NEEDED}</p>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <p style={{ color: 'var(--green)', fontWeight: 600, marginBottom: 20 }}>✅ 등록이 완료되었습니다!</p>
            <button className="btn-contained" style={{ width: '100%', padding: 11 }} onClick={() => navigate('/login')}>
              로그인 하러 가기
            </button>
          </>
        )}

        {status && step !== 'done' && (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 8 }}>{status}</p>
        )}

        <div style={{ marginTop: 20 }}>
          <Link to="/login" style={{ fontSize: '0.875rem', color: 'var(--blue)' }}>← 로그인으로</Link>
        </div>
      </div>
    </div>
  );
}
