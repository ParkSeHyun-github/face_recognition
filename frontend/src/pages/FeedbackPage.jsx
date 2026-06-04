import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { api } from '../api';

const EXERCISE_CHOICES = [
  { value: '', label: '전체 운동' },
  { value: 'squat', label: '스쿼트' },
  { value: 'lunge', label: '런지' },
  { value: 'plank', label: '플랭크' },
  { value: 'overhead_press', label: '오버헤드 프레스' },
];
const COLORS = { squat: '#4285F4', lunge: '#34A853', plank: '#FBBC04', overhead_press: '#EA4335' };

function scoreClass(s) {
  if (s >= 80) return '#34A853';
  if (s >= 50) return '#E37400';
  return '#EA4335';
}

export default function FeedbackPage() {
  const [data, setData] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [filterExercise, setFilterExercise] = useState('');
  const [username, setUsername] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const chartRefs = useRef({});

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    api.me().then(d => setUsername(d?.username || ''));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterDate) params.set('date', filterDate);
    if (filterExercise) params.set('exercise', filterExercise);
    const qs = params.toString() ? '?' + params.toString() : '';
    api.feedback(qs).then(d => { if (d?.ok) setData(d); });
  }, [filterDate, filterExercise]);

  useEffect(() => {
    if (!data) return;
    const Chart = window.Chart;
    if (!Chart) return;

    const dark = theme === 'dark';
    const gridColor  = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const tickColor  = dark ? '#9AA0A6' : '#5F6368';
    const textColor  = dark ? '#E8EAED' : '#202124';

    // 점수별 막대 색상 (다크/라이트 분기)
    const barBg = dark
      ? s => s >= 80 ? '#1B3A2A' : s >= 50 ? '#3A3010' : '#3A1C1C'
      : s => s >= 80 ? '#E6F4EA' : s >= 50 ? '#FEF7E0' : '#FCE8E6';
    const barBorder = s => s >= 80 ? '#34A853' : s >= 50 ? '#FBBC04' : '#EA4335';

    const commonScaleOpts = {
      y: {
        min: 0, max: 100,
        ticks: { color: tickColor, font: { size: 11 } },
        grid: { color: gridColor },
      },
      x: {
        ticks: { color: tickColor, font: { size: 11 } },
        grid: { display: false },
      },
    };

    ['squat', 'lunge', 'plank', 'overhead_press'].forEach(ex => {
      const el = chartRefs.current['daily_' + ex];
      if (!el) return;
      if (el._chart) el._chart.destroy();
      const d = data.chart_data[ex];
      el._chart = new Chart(el, {
        type: 'line',
        data: {
          labels: d.labels.length ? d.labels : ['기록 없음'],
          datasets: [{
            data: d.scores.length ? d.scores : [0],
            borderColor: COLORS[ex],
            backgroundColor: COLORS[ex] + (dark ? '30' : '18'),
            fill: true, tension: 0.4,
            pointRadius: 4, pointBackgroundColor: COLORS[ex],
            borderWidth: 2,
          }],
        },
        options: {
          scales: commonScaleOpts,
          plugins: { legend: { display: false } },
        },
      });
    });

    data.rep_chart.forEach((item, i) => {
      const el = chartRefs.current['rep_' + i];
      if (!el) return;
      if (el._chart) el._chart.destroy();
      el._chart = new Chart(el, {
        type: 'bar',
        data: {
          labels: item.scores.map((_, j) => `${j + 1}회`),
          datasets: [{
            data: item.scores,
            backgroundColor: item.scores.map(barBg),
            borderColor: item.scores.map(barBorder),
            borderWidth: 1.5, borderRadius: 4,
          }],
        },
        options: {
          scales: commonScaleOpts,
          plugins: { legend: { display: false } },
        },
      });
    });
  }, [data, theme]);

  return (
    <>
      <script src="https://cdn.jsdelivr.net/npm/chart.js" />
      <Header username={username} extra={
        <>
          <Link to="/workout/clips" className="btn-text">🎬 내 클립</Link>
          <Link to="/workout" className="btn-text">← 운동으로</Link>
        </>
      } />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '1.5rem', fontWeight: 400, marginBottom: 24 }}>
          운동 피드백 <span style={{ color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 400, marginLeft: 8 }}>{username}님의 기록</span>
        </div>

        {/* 필터 */}
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>필터</span>
          <select value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.875rem', background: 'var(--white)', color: 'var(--text)' }}>
            <option value="">전체 날짜</option>
            {data?.date_list?.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterExercise} onChange={e => setFilterExercise(e.target.value)} style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.875rem', background: 'var(--white)', color: 'var(--text)' }}>
            {EXERCISE_CHOICES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="btn-text" onClick={() => { setFilterDate(''); setFilterExercise(''); }}>초기화</button>
        </div>

        {/* 일별 평균 차트 */}
        {!filterDate && !filterExercise && (
          <>
            <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>일별 평균 점수</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
              {['squat', 'lunge', 'plank', 'overhead_press'].map(ex => (
                <div key={ex} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
                  <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '0.875rem', fontWeight: 500, marginBottom: 4 }}>
                    {EXERCISE_CHOICES.find(e => e.value === ex)?.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 14 }}>일별 평균 점수 추이</div>
                  <canvas ref={el => chartRefs.current['daily_' + ex] = el} height={140} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Rep 차트 */}
        {(filterDate || filterExercise) && data?.rep_chart?.length > 0 && (
          <>
            <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>세트별 Rep 점수</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
              {data.rep_chart.map((item, i) => (
                <div key={i} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
                  <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '0.875rem', fontWeight: 500, marginBottom: 14 }}>{item.label}</div>
                  <canvas ref={el => chartRefs.current['rep_' + i] = el} height={100} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* 기록 테이블 */}
        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>운동 기록</div>
        <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 32 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontFamily: "'Google Sans',sans-serif", fontSize: '0.95rem', fontWeight: 500 }}>기록 목록</div>
          {data?.sessions?.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['운동', '세트', '평균 점수', 'Rep 점수', '날짜'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)', background: '#FAFBFF' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.sessions.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F1F3F4' }}>
                    <td style={{ padding: '13px 20px', fontSize: '0.875rem' }}>{s.exercise_display}</td>
                    <td style={{ padding: '13px 20px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{s.set_number}세트</td>
                    <td style={{ padding: '13px 20px', fontSize: '0.875rem', fontWeight: 500, color: scoreClass(s.score) }}>{s.score}점</td>
                    <td style={{ padding: '13px 20px', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {s.rep_scores.length > 0
                          ? s.rep_scores.map((r, i) => (
                            <span key={i} style={{ padding: '2px 9px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500, background: r >= 80 ? '#E6F4EA' : r >= 50 ? '#FEF7E0' : '#FCE8E6', color: scoreClass(r) }}>{r}</span>
                          ))
                          : <span style={{ padding: '2px 9px', borderRadius: 12, fontSize: '0.75rem', background: '#E8EAED', color: 'var(--text-secondary)' }}>기록 없음</span>}
                      </div>
                    </td>
                    <td style={{ padding: '13px 20px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{s.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>해당 조건의 운동 기록이 없습니다.</div>
          )}
        </div>
      </div>
    </>
  );
}
