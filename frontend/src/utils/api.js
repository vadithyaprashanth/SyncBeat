import axios from 'axios';

const API = axios.create({ baseURL: '/api' });

API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('syncbeat_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      (err.response?.status === 401 || err.response?.status === 403) &&
      err.response.data?.message?.toLowerCase().includes('token')
    ) {
      sessionStorage.clear();
      window.location.href = '/auth';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────
export const apiSignup  = (data) => API.post('/auth/signup', data);
export const apiLogin   = (data) => API.post('/auth/login',  data);

// Forgot password flow
export const apiForgotPasswordRequest   = (data) => API.post('/auth/forgot-password',        data);
export const apiForgotPasswordVerifyOTP = (data) => API.post('/auth/forgot-password/verify', data);
export const apiResetPassword           = (data) => API.post('/auth/reset-password',         data);
export const apiResendResetOTP          = (data) => API.post('/auth/resend-reset-otp',        data);

export const apiDeleteAccount = (data) => API.delete('/auth/account', { data });

// ── Songs ─────────────────────────────────────────────────────────────
export const apiGetSongs   = ()    => API.get('/songs');
export const apiAddSong    = (fd)  => API.post('/songs', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
export const apiDeleteSong = (id)  => API.delete(`/songs/${id}`);

// ── Sessions ──────────────────────────────────────────────────────────
export const apiGetSessions   = ()     => API.get('/sessions');
export const apiCreateSession = (data) => API.post('/sessions', data);
export const apiJoinSession   = (id)   => API.post(`/sessions/${id}/join`);

// ── Admin ─────────────────────────────────────────────────────────────
export const apiGetStats = () => API.get('/admin/stats');
export const apiGetUsers = () => API.get('/admin/users');

export default API;