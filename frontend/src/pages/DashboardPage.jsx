import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { api } from '../api';

const cards = [
  { to: '/workout',           icon: '🏋️', title: '운동 시작',   sub: '자세 분석 및 점수 측정',   blue: true },
  { to: '/workout/feedback',  icon: '📊', title: '피드백 보기',  sub: '운동 기록 및 점수 분석' },
  { to: '/register',          icon: '➕', title: '얼굴 등록',    sub: '새 사용자 얼굴 추가' },
  { to: '/manage',            icon: '⚙️', title: '설정',         sub: '앱 설정 및 사용자 관리' },
];

export default function DashboardPage() {
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboard().then(d => {
      if (d?.ok) setUsername(d.username);
      else navigate('/login');
    });
  }, []);

  return (
    <>
      <Header username={username} />
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 16px' }}>
        <div style={{ width: '100%', maxWidth: 640 }}>

          <div style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 8, padding: '28px 32px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#E8F0FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>👤</div>
            <div>
              <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '1.1rem', fontWeight: 500 }}>안녕하세요, {username}님!</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>얼굴 인식으로 로그인되었습니다.</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {cards.map(({ to, icon, title, sub, blue }) => (
              <Link key={to} to={to}>
                <div style={{
                  background: blue ? 'var(--blue)' : 'var(--white)',
                  border: blue ? 'none' : '1px solid var(--border)',
                  borderRadius: 8, padding: '24px 20px',
                  color: blue ? '#fff' : 'var(--text)',
                  transition: 'box-shadow .15s',
                }}
                  onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(60,64,67,.2)'}
                  onMouseOut={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ fontSize: '1.8rem', marginBottom: 10 }}>{icon}</div>
                  <div style={{ fontFamily: "'Google Sans',sans-serif", fontSize: '1rem', fontWeight: 500 }}>{title}</div>
                  <div style={{ fontSize: '0.8rem', opacity: blue ? 0.85 : 1, color: blue ? undefined : 'var(--text-secondary)', marginTop: 4 }}>{sub}</div>
                </div>
              </Link>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}
