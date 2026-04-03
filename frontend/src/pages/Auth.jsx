import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  apiSignup, apiLogin,
  apiForgotPasswordRequest, apiForgotPasswordVerifyOTP,
  apiResetPassword, apiResendResetOTP,
} from '../utils/api';

// ── 6-box OTP input ───────────────────────────────────────────────────
function OTPInput({ value, onChange }) {
  const inputs = useRef([]);
  const handleChange = (i, e) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const arr = value.split(''); arr[i] = val;
    onChange(arr.join(''));
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) inputs.current[i - 1]?.focus();
  };
  const handlePaste = (e) => {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(p.padEnd(6, '').slice(0, 6));
    inputs.current[Math.min(p.length, 5)]?.focus();
    e.preventDefault();
  };
  return (
    <div className="otp-boxes">
      {[0,1,2,3,4,5].map((i) => (
        <input key={i} ref={(el) => (inputs.current[i] = el)}
          type="text" inputMode="numeric" maxLength={1}
          value={value[i] || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={`otp-box ${value[i] ? 'filled' : ''}`}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}

// ── Password strength indicator ───────────────────────────────────────
function PasswordStrength({ password }) {
  if (!password) return null;
  const checks = [
    password.length >= 6,
    password.length >= 10,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score  = checks.filter(Boolean).length;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
  const colors = ['', '#ff4d6d', '#f7c948', '#7c5cfc', '#2dce89', '#2dce89'];
  return (
    <div className="pass-strength">
      <div className="pass-bars">
        {[1,2,3,4,5].map((n) => (
          <div key={n} className="pass-bar"
            style={{ background: n <= score ? colors[score] : 'var(--border)' }} />
        ))}
      </div>
      <span style={{ color: colors[score], fontSize: 11 }}>{labels[score]}</span>
    </div>
  );
}

// ── Main Auth ─────────────────────────────────────────────────────────
export default function Auth() {
  // 'login' | 'signup' | 'forgot-phone' | 'forgot-otp' | 'forgot-reset'
  const [mode, setMode]           = useState('login');
  const [form, setForm]           = useState({ name: '', phone_number: '', password: '', confirm_password: '' });
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew]   = useState('');
  const [otp, setOtp]             = useState('');
  const [resetToken, setResetToken]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);
  const { login } = useAuth();
  const navigate  = useNavigate();

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setTimeout(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [countdown]);

  const reset = (toMode) => {
    setMode(toMode); setError(''); setSuccess(''); setOtp('');
    setForm({ name: '', phone_number: '', password: '', confirm_password: '' });
    setNewPassword(''); setConfirmNew(''); setResetToken('');
  };

  const f = (k) => (e) => { setForm((p) => ({ ...p, [k]: e.target.value })); setError(''); };

  // ── SIGNUP ───────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password)
      return setError('Passwords do not match');
    setError(''); setLoading(true);
    try {
      const res = await apiSignup({ name: form.name, phone_number: form.phone_number, password: form.password });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Sign up failed. Try again.');
    } finally { setLoading(false); }
  };

  // ── LOGIN ────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await apiLogin({ phone_number: form.phone_number, password: form.password });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Sign in failed. Try again.');
    } finally { setLoading(false); }
  };

  // ── FORGOT Step 1 — request OTP ──────────────────────────────────
  const handleForgotRequest = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await apiForgotPasswordRequest({ phone_number: form.phone_number });
      setMode('forgot-otp');
      setCountdown(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed. Try again.');
    } finally { setLoading(false); }
  };

  // ── FORGOT Step 2 — verify OTP ───────────────────────────────────
  const handleForgotVerifyOTP = async (e) => {
    e.preventDefault();
    if (otp.length < 6) return setError('Enter the complete 6-digit OTP');
    setError(''); setLoading(true);
    try {
      const res = await apiForgotPasswordVerifyOTP({ phone_number: form.phone_number, otp });
      setResetToken(res.data.resetToken);
      setMode('forgot-reset');
      setOtp('');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP.');
      setOtp('');
    } finally { setLoading(false); }
  };

  // ── FORGOT Step 3 — set new password ─────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmNew) return setError('Passwords do not match');
    if (newPassword.length < 6) return setError('Password must be at least 6 characters');
    setError(''); setLoading(true);
    try {
      await apiResetPassword({ resetToken, new_password: newPassword });
      setSuccess('Password reset successfully! You can now sign in.');
      setTimeout(() => reset('login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Try again.');
    } finally { setLoading(false); }
  };

  // ── Resend OTP ────────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0) return;
    setError(''); setLoading(true);
    try {
      await apiResendResetOTP({ phone_number: form.phone_number });
      setCountdown(60); setOtp('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend.');
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-orb auth-orb-3" />
        <div className="auth-grid-lines" />
      </div>

      <div className="auth-split">

        {/* ── LEFT PANEL ───────────────────────────── */}
        <div className="auth-left">
          <div className="auth-brand-wrap">
            <div className="auth-logo-big">🎵</div>
            <h1 className="auth-title">SyncBeat</h1>
            <p className="auth-tagline">Where music becomes<br />a shared experience.</p>
          </div>

          <div className="auth-features">
            {[
              { icon: '🔗', title: 'Real-time Sync',  desc: 'Listen in perfect sync with anyone' },
              { icon: '💬', title: 'Live Chat',        desc: 'Chat together while the music plays' },
              { icon: '🎵', title: 'Music Library',    desc: 'Curated tracks added by admins' },
              { icon: '📱', title: 'Secure Login',     desc: 'Phone & password with OTP reset' },
            ].map((ft) => (
              <div key={ft.title} className="auth-feature">
                <span className="auth-feature-icon">{ft.icon}</span>
                <div>
                  <div className="auth-feature-title">{ft.title}</div>
                  <div className="auth-feature-desc">{ft.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="auth-stat-row">
            <div className="auth-stat"><strong>∞</strong><span>Sync sessions</span></div>
            <div className="auth-stat-div" />
            <div className="auth-stat"><strong>📱</strong><span>OTP secured</span></div>
            <div className="auth-stat-div" />
            <div className="auth-stat"><strong>⚡</strong><span>Real-time</span></div>
          </div>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────── */}
        <div className="auth-right">
          <div className="auth-card">

            {/* ═══ LOGIN ═══ */}
            {mode === 'login' && (
              <>
                <div className="auth-card-header">
                  <h2>Welcome back 👋</h2>
                  <p>Sign in to continue listening</p>
                </div>
                <div className="auth-tabs">
                  <button className="auth-tab active">Sign In</button>
                  <button className="auth-tab" onClick={() => reset('signup')}>Sign Up</button>
                </div>

                <form className="auth-form" onSubmit={handleLogin}>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon">📱</span>
                      <input type="tel" placeholder="e.g. 9876543210"
                        value={form.phone_number} onChange={f('phone_number')}
                        required autoComplete="tel" />
                    </div>
                  </div>

                  <div className="form-group">
                    <div className="label-row">
                      <label>Password</label>
                      <button type="button" className="forgot-link"
                        onClick={() => reset('forgot-phone')}>
                        Forgot password?
                      </button>
                    </div>
                    <div className="input-icon-wrap">
                      <span className="input-icon">🔒</span>
                      <input type={showPass ? 'text' : 'password'} placeholder="Enter your password"
                        value={form.password} onChange={f('password')}
                        required autoComplete="current-password" />
                      <button type="button" className="show-pass-btn"
                        onClick={() => setShowPass((p) => !p)} tabIndex={-1}>
                        {showPass ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>

                  {error && <div className="auth-error">⚠️ {error}</div>}

                  <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? <span className="spinner" /> : 'Sign In →'}
                  </button>
                </form>

                <p className="auth-switch">
                  Don't have an account?{' '}
                  <button className="auth-switch-btn" onClick={() => reset('signup')}>Sign Up</button>
                </p>
              </>
            )}

            {/* ═══ SIGNUP ═══ */}
            {mode === 'signup' && (
              <>
                <div className="auth-card-header">
                  <h2>Join SyncBeat 🎵</h2>
                  <p>Create your free account today</p>
                </div>
                <div className="auth-tabs">
                  <button className="auth-tab" onClick={() => reset('login')}>Sign In</button>
                  <button className="auth-tab active">Sign Up</button>
                </div>

                <form className="auth-form" onSubmit={handleSignup}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon">👤</span>
                      <input type="text" placeholder="Enter your full name"
                        value={form.name} onChange={f('name')}
                        required autoComplete="name" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Phone Number</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon">📱</span>
                      <input type="tel" placeholder="e.g. 9876543210"
                        value={form.phone_number} onChange={f('phone_number')}
                        required autoComplete="tel" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Password</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon">🔒</span>
                      <input type={showPass ? 'text' : 'password'} placeholder="Min. 6 characters"
                        value={form.password} onChange={f('password')}
                        required minLength={6} autoComplete="new-password" />
                      <button type="button" className="show-pass-btn"
                        onClick={() => setShowPass((p) => !p)} tabIndex={-1}>
                        {showPass ? '🙈' : '👁'}
                      </button>
                    </div>
                    <PasswordStrength password={form.password} />
                  </div>

                  <div className="form-group">
                    <label>Confirm Password</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon">🔒</span>
                      <input type="password" placeholder="Re-enter your password"
                        value={form.confirm_password} onChange={f('confirm_password')}
                        required autoComplete="new-password" />
                    </div>
                    {form.confirm_password && form.password !== form.confirm_password && (
                      <span className="field-error">Passwords do not match</span>
                    )}
                  </div>

                  {error && <div className="auth-error">⚠️ {error}</div>}

                  <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? <span className="spinner" /> : 'Create Account →'}
                  </button>
                </form>

                <p className="auth-switch">
                  Already have an account?{' '}
                  <button className="auth-switch-btn" onClick={() => reset('login')}>Sign In</button>
                </p>
              </>
            )}

            {/* ═══ FORGOT — Step 1: Enter Phone ═══ */}
            {mode === 'forgot-phone' && (
              <>
                <button className="otp-back" onClick={() => reset('login')}>← Back to Sign In</button>
                <div className="auth-card-header" style={{ marginTop: 16 }}>
                  <h2>Reset Password 🔑</h2>
                  <p>Enter your phone number to receive a reset OTP</p>
                </div>

                <form className="auth-form" onSubmit={handleForgotRequest}>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon">📱</span>
                      <input type="tel" placeholder="Registered phone number"
                        value={form.phone_number} onChange={f('phone_number')}
                        required autoComplete="tel" autoFocus />
                    </div>
                  </div>

                  {error && <div className="auth-error">⚠️ {error}</div>}

                  <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? <span className="spinner" /> : 'Send Reset OTP →'}
                  </button>
                </form>
              </>
            )}

            {/* ═══ FORGOT — Step 2: Verify OTP ═══ */}
            {mode === 'forgot-otp' && (
              <div className="otp-section">
                <button className="otp-back" onClick={() => { setMode('forgot-phone'); setError(''); setOtp(''); }}>
                  ← Back
                </button>

                <div className="otp-header">
                  <div className="otp-icon">📱</div>
                  <h2>Check Your Phone</h2>
                  <p className="otp-subtitle">
                    Enter the 6-digit reset code sent to<br />
                    <strong className="otp-phone">{form.phone_number}</strong>
                  </p>
                </div>

                <form onSubmit={handleForgotVerifyOTP}>
                  <OTPInput value={otp} onChange={(v) => { setOtp(v); setError(''); }} />
                  {error && <div className="auth-error">⚠️ {error}</div>}
                  <button type="submit" className="auth-submit" disabled={loading || otp.length < 6}>
                    {loading ? <span className="spinner" /> : 'Verify OTP →'}
                  </button>
                </form>

                <div className="otp-resend">
                  {countdown > 0
                    ? <span className="otp-timer">Resend in <strong>{countdown}s</strong></span>
                    : <button className="otp-resend-btn" onClick={handleResend} disabled={loading}>🔄 Resend OTP</button>
                  }
                </div>

                <div className="otp-dev-hint">
                  💡 OTP not received? Check the <strong>backend terminal</strong> (development mode).
                </div>
              </div>
            )}

            {/* ═══ FORGOT — Step 3: New Password ═══ */}
            {mode === 'forgot-reset' && (
              <>
                <div className="auth-card-header">
                  <h2>Set New Password ✅</h2>
                  <p>Choose a strong new password for your account</p>
                </div>

                <form className="auth-form" onSubmit={handleResetPassword}>
                  <div className="form-group">
                    <label>New Password</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon">🔒</span>
                      <input type={showNewPass ? 'text' : 'password'} placeholder="Min. 6 characters"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                        required minLength={6} autoFocus />
                      <button type="button" className="show-pass-btn"
                        onClick={() => setShowNewPass((p) => !p)} tabIndex={-1}>
                        {showNewPass ? '🙈' : '👁'}
                      </button>
                    </div>
                    <PasswordStrength password={newPassword} />
                  </div>

                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <div className="input-icon-wrap">
                      <span className="input-icon">🔒</span>
                      <input type="password" placeholder="Re-enter new password"
                        value={confirmNew}
                        onChange={(e) => { setConfirmNew(e.target.value); setError(''); }}
                        required />
                    </div>
                    {confirmNew && newPassword !== confirmNew && (
                      <span className="field-error">Passwords do not match</span>
                    )}
                  </div>

                  {error   && <div className="auth-error">⚠️ {error}</div>}
                  {success && <div className="auth-success">✅ {success}</div>}

                  <button type="submit" className="auth-submit"
                    disabled={loading || newPassword !== confirmNew || newPassword.length < 6}>
                    {loading ? <span className="spinner" /> : 'Reset Password →'}
                  </button>
                </form>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}