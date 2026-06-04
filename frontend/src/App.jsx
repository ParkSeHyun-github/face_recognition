import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from './api';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import WorkoutPage from './pages/WorkoutPage';
import FeedbackPage from './pages/FeedbackPage';
import ClipsPage from './pages/ClipsPage';
import ManagePage from './pages/ManagePage';

function RequireAuth({ children }) {
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    api.me().then(d => setAuth(d?.authenticated ?? false));
  }, []);

  if (auth === null) return null;
  if (!auth) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/workout" element={<RequireAuth><WorkoutPage /></RequireAuth>} />
        <Route path="/workout/feedback" element={<RequireAuth><FeedbackPage /></RequireAuth>} />
        <Route path="/workout/clips" element={<RequireAuth><ClipsPage /></RequireAuth>} />
        <Route path="/manage" element={<RequireAuth><ManagePage /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}
