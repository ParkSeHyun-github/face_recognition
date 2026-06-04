import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

const EXERCISES = [
  { value: 'squat', label: '스쿼트' },
  { value: 'lunge', label: '런지' },
  { value: 'plank', label: '플랭크' },
  { value: 'overhead_press', label: '오버헤드 프레스' },
];

const EXERCISE_NAMES = Object.fromEntries(EXERCISES.map(e => [e.value, e.label]));

const MIME = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
  ? 'video/webm;codecs=vp8' : 'video/webm';

function getRepFeedback(score) {
  if (score >= 90) return { text: '훌륭한 자세입니다!', cls: '#34A853' };
  if (score >= 75) return { text: '자세가 양호합니다.', cls: '#4285F4' };
  if (score >= 55) return { text: '자세 개선이 필요합니다.', cls: '#E37400' };
  return { text: '자세를 다시 확인해 주세요.', cls: '#EA4335' };
}

// MediaPipe Pose 연결선 정의 (33개 랜드마크)
const POSE_CONNECTIONS = [
  [11,12],[11,13],[13,15],[12,14],[14,16], // 어깨~손목
  [11,23],[12,24],[23,24],                  // 몸통
  [23,25],[25,27],[27,29],[29,31],          // 왼쪽 다리
  [24,26],[26,28],[28,30],[30,32],          // 오른쪽 다리
  [15,17],[15,19],[15,21],[16,18],[16,20],[16,22], // 손
  [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8], // 얼굴
];

function drawSkeleton(canvas, landmarks, videoEl) {
  const ctx = canvas.getContext('2d');
  const vw = videoEl.videoWidth || 640;
  const vh = videoEl.videoHeight || 480;
  const cw = canvas.width = videoEl.clientWidth;
  const ch = canvas.height = videoEl.clientHeight;
  ctx.clearRect(0, 0, cw, ch);
  if (!landmarks?.length) return;

  const sx = cw / vw;
  const sy = ch / vh;

  // 연결선
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  for (const [a, b] of POSE_CONNECTIONS) {
    const lmA = landmarks[a], lmB = landmarks[b];
    if (lmA.visibility < 0.3 || lmB.visibility < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(lmA.x * vw * sx, lmA.y * vh * sy);
    ctx.lineTo(lmB.x * vw * sx, lmB.y * vh * sy);
    ctx.stroke();
  }

  // 관절 점
  for (const lm of landmarks) {
    if (lm.visibility < 0.3) continue;
    ctx.beginPath();
    ctx.arc(lm.x * vw * sx, lm.y * vh * sy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4285F4';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export default function WorkoutPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const repRecorderRef = useRef(null);
  const repChunksRef = useRef([]);
  const isRecordingRef = useRef(false);
  const prevStageRef = useRef('');

  const [username, setUsername] = useState('');
  const [exercise, setExercise] = useState('squat');
  const [streaming, setStreaming] = useState(false);
  const [setNumber, setSetNumber] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [lastScore, setLastScore] = useState(null);
  const [stage, setStage] = useState('대기 중');
  const [angles, setAngles] = useState({});
  const [modal, setModal] = useState(null); // { setNum, score }
  const [summary, setSummary] = useState(null); // { avgScore, repScores, repFeedbacks, clipIds, exercise, setNum }
  const [saveVideo, setSaveVideo] = useState(true);

  const repScoresRef = useRef([]);
  const repFeedbacksRef = useRef([]);
  const savedClipIdsRef = useRef([]);
  const currentExerciseRef = useRef('squat');
  const setNumberRef = useRef(0);
  const streamingRef = useRef(false);

  const navigate = useNavigate();

  useEffect(() => {
    api.me().then(d => setUsername(d?.username || ''));
    navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    });
    return () => {
      clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function startSet() {
    const data = await api.workoutStart(exercise);
    if (!data?.ok) { alert(data?.error); return; }
    const newSet = setNumberRef.current + 1;
    setNumberRef.current = newSet;
    currentExerciseRef.current = exercise;
    repScoresRef.current = [];
    repFeedbacksRef.current = [];
    savedClipIdsRef.current = [];
    setSetNumber(newSet);
    setRepCount(0);
    setLastScore(null);
    streamingRef.current = true;
    setStreaming(true);
    intervalRef.current = setInterval(sendFrame, 200);
  }

  async function sendFrame() {
    if (!streamingRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, 640, 480);
    const image = canvas.toDataURL('image/jpeg', 0.7);
    const data = await api.workoutFrame(image);
    if (!data?.ok) return;
    if (!data.detected) {
      if (overlayRef.current && videoRef.current)
        overlayRef.current.getContext('2d').clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      return;
    }
    if (overlayRef.current && videoRef.current && data.landmarks)
      drawSkeleton(overlayRef.current, data.landmarks, videoRef.current);

    setStage(data.stage);
    setRepCount(data.rep_count);
    if (data.last_score !== undefined) setLastScore(data.last_score);
    setAngles(data.angles || {});

    const curStage = data.stage;
    if (prevStageRef.current === 'STANDING' && (curStage === 'GOING_DOWN' || curStage === 'BOTTOM')) {
      startRepRecording();
    }
    prevStageRef.current = curStage;

    if (data.score !== null && data.score !== undefined) {
      repScoresRef.current.push(data.score);
      repFeedbacksRef.current.push(data.feedback || []);
      stopAndSaveClip(data.rep_count, data.score);
    }
  }

  async function finishSet() {
    streamingRef.current = false;
    setStreaming(false);
    clearInterval(intervalRef.current);
    const data = await api.workoutFinish(setNumberRef.current);
    if (!data?.ok) { alert(data?.error); return; }
    setModal({ setNum: setNumberRef.current, score: data.saved_score });
  }

  function startRepRecording() {
    if (isRecordingRef.current || !streamRef.current) return;
    repChunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: MIME });
    recorder.ondataavailable = e => { if (e.data?.size > 0) repChunksRef.current.push(e.data); };
    recorder.start(200);
    repRecorderRef.current = recorder;
    isRecordingRef.current = true;
  }

  function stopAndSaveClip(repNumber, score) {
    if (!isRecordingRef.current || !repRecorderRef.current) return;
    repRecorderRef.current.onstop = async () => {
      if (!repChunksRef.current.length) return;
      const blob = new Blob(repChunksRef.current, { type: 'video/webm' });
      const form = new FormData();
      form.append('video', blob, `rep_${repNumber}.webm`);
      form.append('rep_number', repNumber);
      form.append('score', score);
      form.append('exercise', currentExerciseRef.current);
      const res = await api.saveClip(form);
      if (res?.ok && res.clip_id) savedClipIdsRef.current.push(res.clip_id);
    };
    repRecorderRef.current.stop();
    isRecordingRef.current = false;
  }

  function openSummary() {
    setModal(null);
    setSummary({
      exercise: currentExerciseRef.current,
      setNum: setNumberRef.current,
      avgScore: modal?.score,
      repScores: [...repScoresRef.current],
      repFeedbacks: [...repFeedbacksRef.current],
      clipIds: [...savedClipIdsRef.current],
    });
    setSaveVideo(true);
  }

  async function confirmSummary() {
    if (!saveVideo && summary?.clipIds?.length) {
      await Promise.all(summary.clipIds.map(id => api.deleteClip(id)));
    }
    navigate('/workout/feedback');
  }

  function continueWorkout() {
    setModal(null);
    setStreaming(false);
  }

  const stageColor = { BOTTOM: '#EA4335', GOING_DOWN: '#E37400', GOING_UP: '#34A853', STANDING: '#4285F4' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>

      {/* 헤더 */}
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 64, zIndex: 100, background: 'var(--white)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <Link to="/dashboard" style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '1.2rem', fontWeight: 700 }}>
          <span style={{ color: 'var(--blue)' }}>Pose</span><span style={{ color: 'var(--text)' }}>Fit</span>
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{username}</span>
          <Link to="/dashboard" className="btn-text">← 홈</Link>
          <Link to="/workout/feedback" className="btn-outlined">피드백</Link>
        </div>
      </header>

      <div style={{ paddingTop: 64, display: 'flex', height: '100vh' }}>

        {/* 사이드바 */}
        <aside style={{ width: 300, flexShrink: 0, background: 'var(--white)', borderRight: '1px solid var(--border)', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>운동 선택</div>
            <select value={exercise} onChange={e => setExercise(e.target.value)} disabled={streaming}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.9rem', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}>
              {EXERCISES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!streaming && <button className="btn-contained" style={{ padding: 11, borderRadius: 4, fontSize: '0.9rem' }} onClick={startSet}>▶ 세트 시작</button>}
            {streaming && <button className="btn-danger" style={{ padding: 11, borderRadius: 4, fontSize: '0.9rem' }} onClick={finishSet}>■ 세트 종료</button>}
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>현황</div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '14px 16px' }}>
              {[
                ['단계', <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 500, background: stageColor[stage] ? stageColor[stage] + '20' : '#E8EAED', color: stageColor[stage] || 'var(--text-secondary)' }}>{stage}</span>],
                ['세트', `${setNumber}세트`],
                ['횟수', `${repCount}회`],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>최근 점수</div>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '3rem', fontWeight: 400, color: 'var(--blue)', lineHeight: 1 }}>{lastScore ?? '—'}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>점 (마지막 Rep)</div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>관절 각도</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 2 }}>
              {Object.entries(angles).length > 0
                ? Object.entries(angles).map(([k, v]) => <div key={k}><b>{k}</b>: {v}°</div>)
                : '—'}
            </div>
          </div>
        </aside>

        {/* 웹캠 */}
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <video ref={videoRef} autoPlay playsInline style={{ maxHeight: 'calc(100vh - 112px)', maxWidth: '100%', borderRadius: 4, display: 'block' }} />
            <canvas ref={overlayRef} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', borderRadius: 4 }} />
          </div>
        </main>
      </div>

      <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />

      {/* 세트 완료 모달 */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(32,33,36,.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--white)', borderRadius: 8, padding: '40px 48px', minWidth: 340, textAlign: 'center', boxShadow: '0 24px 48px rgba(0,0,0,.2)' }}>
            <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '1.3rem', fontWeight: 400 }}>세트 {modal.setNum} 완료</div>
            <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '4rem', fontWeight: 300, color: 'var(--blue)', margin: '12px 0' }}>{modal.score}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 28 }}>점 · 세트 평균 점수</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn-outlined" style={{ padding: '10px 24px' }} onClick={continueWorkout}>다음 세트</button>
              <button className="btn-contained" style={{ padding: '10px 24px' }} onClick={openSummary}>운동 완료 →</button>
            </div>
          </div>
        </div>
      )}

      {/* 운동 완료 요약 모달 */}
      {summary && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(32,33,36,.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--white)', borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,.25)' }}>
            <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
              <h2 style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '1.4rem', fontWeight: 500 }}>
                {EXERCISE_NAMES[summary.exercise]} — {summary.setNum}세트 완료
              </h2>
              <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '3.5rem', fontWeight: 300, color: 'var(--blue)', lineHeight: 1.1, margin: '8px 0 4px' }}>{summary.avgScore}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>세트 평균 점수</div>
            </div>

            <div style={{ padding: '20px 32px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Rep 별 피드백</div>

              {summary.repScores.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>기록된 Rep이 없습니다.</p>
              ) : summary.repScores.map((score, i) => {
                const { text, cls } = getRepFeedback(score);
                const joints = summary.repFeedbacks[i] || [];
                const badItems = joints.filter(j => j.status !== 'ok');
                const okItems = joints.filter(j => j.status === 'ok');
                return (
                  <RepItem key={i} index={i} score={score} text={text} cls={cls} badItems={badItems} okItems={okItems} />
                );
              })}

              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.08em', margin: '20px 0 12px' }}>영상 저장</div>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>이번 세트 영상 클립</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Rep 별 녹화 영상을 저장하거나 삭제할 수 있습니다.</div>
                  </div>
                  <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                    <button onClick={() => setSaveVideo(true)} style={{ padding: '7px 16px', fontSize: '0.8rem', fontWeight: 500, border: 'none', cursor: 'pointer', background: saveVideo ? '#E6F4EA' : 'var(--white)', color: saveVideo ? '#34A853' : 'var(--text-secondary)' }}>저장</button>
                    <button onClick={() => setSaveVideo(false)} style={{ padding: '7px 16px', fontSize: '0.8rem', fontWeight: 500, border: 'none', cursor: 'pointer', background: !saveVideo ? '#FCE8E6' : 'var(--white)', color: !saveVideo ? '#EA4335' : 'var(--text-secondary)' }}>삭제</button>
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {saveVideo ? '✅ 영상이 저장됩니다. 클립 페이지에서 확인할 수 있습니다.' : '🗑️ 이번 세트의 영상 클립이 모두 삭제됩니다.'}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 32px 28px', display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button className="btn-outlined" style={{ padding: '10px 24px' }} onClick={() => { setSummary(null); setStreaming(false); }}>닫기</button>
              <button className="btn-contained" style={{ padding: '10px 24px' }} onClick={confirmSummary}>확인 후 피드백 보기 →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RepItem({ index, score, text, cls, badItems, okItems }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>{index + 1}</div>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Rep {index + 1}</span>
          {badItems.length > 0
            ? <span style={{ marginLeft: 6, background: '#FEF7E0', color: '#E37400', fontSize: '0.7rem', fontWeight: 600, padding: '1px 7px', borderRadius: 10 }}>{badItems.length}개 개선 필요</span>
            : <span style={{ marginLeft: 6, background: '#E6F4EA', color: '#34A853', fontSize: '0.7rem', fontWeight: 600, padding: '1px 7px', borderRadius: 10 }}>완벽</span>}
        </div>
        <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '1.4rem', fontWeight: 400, color: cls }}>{score}</div>
        <span style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </div>
      {open && (
        <div style={{ padding: '0 14px 10px 54px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {badItems.map((j, k) => (
            <JointRow key={k} j={j} warn />
          ))}
          {okItems.map((j, k) => (
            <JointRow key={k} j={j} />
          ))}
          {badItems.length === 0 && okItems.length === 0 && (
            <div style={{ fontSize: '0.78rem', color: '#34A853', background: '#E6F4EA', borderRadius: 6, padding: '5px 8px' }}>모든 관절 각도가 좋습니다!</div>
          )}
        </div>
      )}
    </div>
  );
}

function JointRow({ j, warn }) {
  const bg = warn ? '#FEF7E0' : '#E6F4EA';
  const iconColor = warn ? '#E37400' : '#34A853';
  const icon = warn ? (j.status === 'high' ? '▲' : '▼') : '✓';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '20px 72px 100px 1fr', alignItems: 'center', gap: 8, fontSize: '0.78rem', padding: '5px 8px', borderRadius: 6, background: bg }}>
      <span style={{ color: iconColor, textAlign: 'center' }}>{icon}</span>
      <span style={{ fontWeight: 600 }}>{j.joint}</span>
      <span style={{ color: 'var(--text-secondary)' }}>{j.angle}° <span style={{ fontSize: '0.7rem' }}>(목표 {j.target})</span></span>
      <span>{j.message}</span>
    </div>
  );
}
