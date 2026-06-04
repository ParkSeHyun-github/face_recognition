import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { api } from '../api';

const EXERCISE_FILTERS = [
  { value: '', label: '전체' },
  { value: 'squat', label: '스쿼트' },
  { value: 'lunge', label: '런지' },
  { value: 'plank', label: '플랭크' },
  { value: 'overhead_press', label: '오버헤드 프레스' },
];

function scoreColor(s) {
  if (s >= 80) return '#34A853';
  if (s >= 50) return '#E37400';
  return '#EA4335';
}

export default function ClipsPage() {
  const [clips, setClips] = useState([]);
  const [filter, setFilter] = useState('');
  const [username, setUsername] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.me().then(d => setUsername(d?.username || ''));
    api.clips().then(d => { if (d?.ok) setClips(d.clips); });
  }, []);

  const filtered = filter ? clips.filter(c => c.exercise === filter) : clips;

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(c => c.id)));
    }
  }

  async function deleteClip(id) {
    if (!confirm('클립을 삭제하시겠습니까?')) return;
    const data = await api.deleteClip(id);
    if (data?.ok) {
      setClips(prev => prev.filter(c => c.id !== id));
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function deleteSelected() {
    if (!selected.size) return;
    if (!confirm(`선택한 ${selected.size}개 클립을 삭제하시겠습니까?`)) return;
    setDeleting(true);
    await Promise.all([...selected].map(id => api.deleteClip(id)));
    setClips(prev => prev.filter(c => !selected.has(c.id)));
    setSelected(new Set());
    setDeleting(false);
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <>
      <Header username={username} extra={
        <>
          <Link to="/workout/feedback" className="btn-text">← 피드백으로</Link>
          <Link to="/workout" className="btn-text">운동으로</Link>
        </>
      } />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '1.5rem', fontWeight: 400, marginBottom: 8 }}>내 클립</div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 20 }}>Rep 단위로 저장된 운동 영상 클립</p>

        {/* 필터 + 선택 삭제 툴바 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EXERCISE_FILTERS.map(({ value, label }) => (
              <button key={value} onClick={() => { setFilter(value); setSelected(new Set()); }} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 500,
                border: '1px solid var(--border)', cursor: 'pointer',
                background: filter === value ? 'var(--blue)' : 'var(--white)',
                color: filter === value ? '#fff' : 'var(--text-secondary)',
              }}>{label}</button>
            ))}
          </div>

          {filtered.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={toggleSelectAll} style={{
                padding: '6px 14px', borderRadius: 4, fontSize: '0.85rem', fontWeight: 500,
                border: '1px solid var(--border)', cursor: 'pointer',
                background: allSelected ? '#E8F0FE' : 'var(--white)',
                color: allSelected ? 'var(--blue)' : 'var(--text-secondary)',
              }}>
                {allSelected ? '✓ 전체 선택됨' : '전체 선택'}
              </button>
              {selected.size > 0 && (
                <button className="btn-danger" onClick={deleteSelected} disabled={deleting}
                  style={{ padding: '6px 16px', fontSize: '0.85rem' }}>
                  {deleting ? '삭제 중...' : `선택 삭제 (${selected.size})`}
                </button>
              )}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 64, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>저장된 클립이 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtered.map(clip => {
              const isSelected = selected.has(clip.id);
              return (
                <div key={clip.id} onClick={() => toggleSelect(clip.id)} style={{
                  background: 'var(--white)', border: `2px solid ${isSelected ? 'var(--blue)' : 'var(--border)'}`,
                  borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                  boxShadow: isSelected ? '0 0 0 3px rgba(66,133,244,.15)' : 'none',
                  transition: 'border-color .15s, box-shadow .15s',
                }}>
                  {/* 선택 체크박스 */}
                  <div style={{ position: 'relative' }}>
                    <video src={clip.video_url} controls onClick={e => e.stopPropagation()}
                      style={{ width: '100%', display: 'block', background: '#000', maxHeight: 200 }} />
                    <div style={{
                      position: 'absolute', top: 8, left: 8,
                      width: 22, height: 22, borderRadius: 4,
                      background: isSelected ? 'var(--blue)' : 'rgba(255,255,255,0.85)',
                      border: `2px solid ${isSelected ? 'var(--blue)' : '#ccc'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', color: '#fff', fontWeight: 700,
                    }}>
                      {isSelected && '✓'}
                    </div>
                  </div>
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontFamily: "'Google Sans',sans-serif", fontWeight: 500 }}>{clip.exercise_display} · Rep {clip.rep_number}</span>
                      <span style={{ fontWeight: 600, color: scoreColor(clip.score) }}>{clip.score}점</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 10 }}>{clip.created_at}</div>
                    <button className="btn-danger" style={{ width: '100%', padding: '7px', fontSize: '0.8rem' }}
                      onClick={e => { e.stopPropagation(); deleteClip(clip.id); }}>
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
