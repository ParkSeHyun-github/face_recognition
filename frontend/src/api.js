const BASE = '';  // Vite proxy: /api → http://localhost:8000/api

async function getCsrf() {
  const res = await fetch(`${BASE}/api/csrf/`, { credentials: 'include' });
  const data = await res.json();
  return data.csrfToken;
}

function getCookie(name) {
  const v = document.cookie.match('(^|;) ?' + name + '=([^;]*)(;|$)');
  return v ? v[2] : null;
}

export async function apiFetch(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = { ...options.headers };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  // CSRF token for unsafe methods
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    let csrf = getCookie('csrftoken');
    if (!csrf) csrf = await getCsrf();
    headers['X-CSRFToken'] = csrf;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok && res.status === 401) {
    window.location.href = '/login';
    return null;
  }

  return res.json();
}

export const api = {
  csrf:           () => apiFetch('/api/csrf/'),
  me:             () => apiFetch('/api/me/'),
  logout:         () => apiFetch('/api/logout/'),
  dashboard:      () => apiFetch('/api/dashboard/'),
  manage:         () => apiFetch('/api/manage/'),
  manageAuth:     (password) => apiFetch('/api/manage/', { method: 'POST', body: JSON.stringify({ password }) }),
  manageDelete:   (id) => apiFetch(`/api/manage/delete/${id}/`, { method: 'POST' }),
  registerStart:  (username) => apiFetch('/api/register/start/', { method: 'POST', body: JSON.stringify({ username }) }),
  registerFrame:  (image) => apiFetch('/api/register/frame/', { method: 'POST', body: JSON.stringify({ image }) }),
  registerFinish: () => apiFetch('/api/register/finish/', { method: 'POST', body: '{}' }),
  loginFrame:     (image) => apiFetch('/api/login/frame/', { method: 'POST', body: JSON.stringify({ image }) }),
  workoutStart:   (exercise) => apiFetch('/api/workout/start/', { method: 'POST', body: JSON.stringify({ exercise }) }),
  workoutFrame:   (image) => apiFetch('/api/workout/frame/', { method: 'POST', body: JSON.stringify({ image }) }),
  workoutFinish:  (set_number) => apiFetch('/api/workout/finish/', { method: 'POST', body: JSON.stringify({ set_number }) }),
  saveClip:       (form) => apiFetch('/api/workout/save_clip/', { method: 'POST', body: form }),
  deleteClip:     (id) => apiFetch(`/api/workout/delete_clip/${id}/`, { method: 'POST' }),
  feedback:       (params = '') => apiFetch(`/api/workout/feedback/${params}`),
  clips:          () => apiFetch('/api/workout/clips/'),
};
