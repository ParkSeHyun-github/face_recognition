import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { api } from '../api';

const sectionLabel = {
  fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10,
};
const card = {
  background: 'var(--white)', border: '1px solid var(--border)',
  borderRadius: 8, overflow: 'hidden', marginBottom: 24,
};
const row = {
  padding: '16px 20px', display: 'flex', justifyContent: 'space-between',
  alignItems: 'center', borderBottom: '1px solid var(--border)',
};
const rowLast = { ...row, borderBottom: 'none' };

export default function ManagePage() {
  const [username, setUsername] = useState('');
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const navigate = useNavigate();

  useEffect(() => {
    api.me().then(d => setUsername(d?.username || ''));
    api.manage().then(d => {
      if (d?.authenticated) { setAuthed(true); setUsers(d.users); }
    });
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  async function submitPassword() {
    const data = await api.manageAuth(password);
    if (data?.ok) {
      setAuthed(true);
      const res = await api.manage();
      if (res?.ok) setUsers(res.users);
    } else {
      setError(data?.error || '비밀번호가 틀렸습니다.');
    }
  }

  async function deleteUser(id, name) {
    if (!confirm(`'${name}'을(를) 삭제하시겠습니까?`)) return;
    const data = await api.manageDelete(id);
    if (data?.ok) setUsers(prev => prev.filter(u => u.id !== id));
  }

  return (
    <>
      <Header username={username} extra={<Link to="/dashboard" className="btn-text">← 홈</Link>} />

      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>

          <h1 style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '1.5rem', fontWeight: 400, color: 'var(--text)', marginBottom: 28 }}>설정</h1>

          {/* 앱 설정 */}
          <div style={sectionLabel}>앱 설정</div>
          <div style={card}>
            <div style={row}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>테마</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>라이트 / 다크 모드 전환</div>
              </div>
              <button onClick={toggleTheme} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 14px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {theme === 'dark' ? '☀️ 라이트' : '🌙 다크'}
              </button>
            </div>
            <div style={rowLast}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>얼굴 등록</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>새 사용자 얼굴 데이터 추가</div>
              </div>
              <button className="btn-outlined" style={{ padding: '7px 16px', fontSize: '0.85rem' }} onClick={() => navigate('/register')}>
                등록하기
              </button>
            </div>
          </div>

          {/* 관리자 */}
          <div style={sectionLabel}>관리자</div>

          {!authed ? (
            <div style={{ ...card, padding: '24px 20px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: 12 }}>관리자 인증</div>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="관리자 비밀번호"
                onKeyDown={e => e.key === 'Enter' && submitPassword()}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.9rem', marginBottom: 10, fontFamily: 'inherit', background: 'var(--white)', color: 'var(--text)', outline: 'none' }}
              />
              {error && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 10 }}>{error}</p>}
              <button className="btn-contained" onClick={submitPassword}>확인</button>
            </div>
          ) : (
            <>
              <div style={card}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '0.95rem', fontWeight: 500 }}>등록된 사용자</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>총 {users.length}명</span>
                </div>
                {users.length === 0 ? (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>등록된 사용자가 없습니다.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['ID', '이름', '샘플 수', '삭제'].map(h => (
                          <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--border)', background: '#FAFBFF' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #F1F3F4' }}>
                          <td style={{ padding: '13px 20px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{u.id}</td>
                          <td style={{ padding: '13px 20px', fontSize: '0.875rem', fontWeight: 500 }}>{u.name}</td>
                          <td style={{ padding: '13px 20px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{u.samples}장</td>
                          <td style={{ padding: '13px 20px', textAlign: 'center' }}>
                            <button onClick={() => deleteUser(u.id, u.name)} style={{ background: '#FCE8E6', color: 'var(--red)', border: '1px solid #F5C6C3', padding: '5px 14px', fontSize: '0.8rem', borderRadius: 4, cursor: 'pointer' }}>삭제</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div style={{ padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                관리자 비밀번호: <code style={{ color: 'var(--blue)', background: '#E8F0FE', padding: '2px 6px', borderRadius: 3 }}>admin1234</code>
                &nbsp;·&nbsp; settings.py에서 변경 가능
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
