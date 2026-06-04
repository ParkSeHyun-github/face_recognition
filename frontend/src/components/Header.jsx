import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useEffect, useState } from 'react';

const style = {
  header: {
    position: 'sticky', top: 0, zIndex: 100,
    background: 'var(--white)', borderBottom: '1px solid var(--border)',
    height: 64, display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '0 24px',
  },
  brand: { fontFamily: "'Google Sans', sans-serif", fontSize: '1.2rem', fontWeight: 700, textDecoration: 'none' },
  fit: { color: 'var(--blue)' },
  face: { color: 'var(--text)' },
  right: { display: 'flex', gap: 8, alignItems: 'center' },
  username: { fontSize: '0.85rem', color: 'var(--text-secondary)' },
  themeBtn: {
    background: 'none', border: '1px solid var(--border)', borderRadius: 20,
    padding: '5px 12px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)',
  },
};

export default function Header({ username, extra }) {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
  }

  async function logout() {
    await api.logout();
    navigate('/login');
  }

  return (
    <header style={style.header}>
      <a href="/dashboard" style={style.brand}>
        <span style={style.fit}>Pose</span><span style={style.face}>Fit</span>
      </a>
      <div style={style.right}>
        {username && <span style={style.username}>{username}님</span>}
        <button style={style.themeBtn} onClick={toggleTheme}>
          {theme === 'dark' ? '☀️ 라이트' : '🌙 다크'}
        </button>
        {extra}
        {username && (
          <button className="btn-danger" style={{ padding: '7px 14px', fontSize: '0.8rem' }} onClick={logout}>
            로그아웃
          </button>
        )}
      </div>
    </header>
  );
}
