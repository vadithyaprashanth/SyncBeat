const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');

// ── OTP store (only used for password reset) ─────────────────────────
const otpStore = new Map();

// ── Twilio SMS ───────────────────────────────────────────────────────
let twilioClient = null;
if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN && process.env.TWILIO_PHONE) {
  try {
    twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    console.log('✅ Twilio SMS enabled');
  } catch (e) {
    console.log('❌ Twilio failed:', e.message);
  }
} else {
  console.log('📋 Twilio not configured — reset OTPs will print to console');
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
}

async function sendSMS(phone, otp) {
  const message = `Your SyncBeat password reset code is: ${otp}. Valid for 5 minutes. Do not share it.`;
  if (twilioClient) {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: phone,
    });
    console.log(`📱 Reset OTP SMS sent to ${phone}`);
  } else {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📱 RESET OTP for ${phone} : ${otp}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

function checkBlocked(user) {
  if (user.is_blocked) {
    const reason = user.block_reason ? `: ${user.block_reason}` : '';
    return `Your account has been suspended${reason}. Please contact support.`;
  }
  if (user.deactivated_until && new Date(user.deactivated_until) > new Date()) {
    return `Your account is temporarily deactivated until ${new Date(user.deactivated_until).toLocaleString()}.`;
  }
  return null;
}

// ── SIGNUP — direct phone + password, no OTP ─────────────────────────
const signup = async (req, res) => {
  const { name, phone_number, password } = req.body;
  if (!name || !phone_number || !password)
    return res.status(400).json({ message: 'Name, phone number and password are required' });
  if (password.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters' });

  try {
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE phone_number = ?', [phone_number]
    );
    if (existing.length > 0)
      return res.status(409).json({ message: 'Phone number already registered. Please sign in.' });

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, phone_number, password_hash) VALUES (?, ?, ?)',
      [name, phone_number, password_hash]
    );

    const token = signToken({ id: result.insertId, name, phone_number, role: 'user' });
    res.status(201).json({
      token,
      user: { id: result.insertId, name, phone_number, role: 'user' },
    });
  } catch (err) {
    console.error('signup error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ── LOGIN — direct phone + password, no OTP ──────────────────────────
const login = async (req, res) => {
  const { phone_number, password } = req.body;
  if (!phone_number || !password)
    return res.status(400).json({ message: 'Phone number and password are required' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE phone_number = ?', [phone_number]
    );
    if (rows.length === 0)
      return res.status(401).json({ message: 'Invalid phone number or password' });

    const user       = rows[0];
    const blockedMsg = checkBlocked(user);
    if (blockedMsg) return res.status(403).json({ message: blockedMsg });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ message: 'Invalid phone number or password' });

    const token = signToken({
      id: user.id, name: user.name,
      phone_number: user.phone_number, role: user.role,
    });
    res.json({
      token,
      user: { id: user.id, name: user.name, phone_number: user.phone_number, role: user.role },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ── FORGOT PASSWORD Step 1 — send OTP to phone ───────────────────────
const forgotPasswordRequest = async (req, res) => {
  const { phone_number } = req.body;
  if (!phone_number)
    return res.status(400).json({ message: 'Phone number is required' });

  try {
    const [rows] = await pool.query(
      'SELECT id, is_blocked, block_reason, deactivated_until FROM users WHERE phone_number = ?',
      [phone_number]
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'No account found with this phone number' });

    const user       = rows[0];
    const blockedMsg = checkBlocked(user);
    if (blockedMsg) return res.status(403).json({ message: blockedMsg });

    const otp       = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    otpStore.set(`reset:${phone_number}`, { otp, expiresAt, userId: user.id });

    await sendSMS(phone_number, otp);
    res.json({ message: `Password reset OTP sent to ${phone_number}`, phone_number });
  } catch (err) {
    console.error('forgotPasswordRequest error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ── FORGOT PASSWORD Step 2 — verify OTP ──────────────────────────────
const forgotPasswordVerifyOTP = async (req, res) => {
  const { phone_number, otp } = req.body;
  if (!phone_number || !otp)
    return res.status(400).json({ message: 'Phone number and OTP are required' });

  const entry = otpStore.get(`reset:${phone_number}`);
  if (!entry)
    return res.status(400).json({ message: 'No reset request found. Please request again.' });
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(`reset:${phone_number}`);
    return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
  }
  if (entry.otp !== otp.trim())
    return res.status(400).json({ message: 'Invalid OTP. Please try again.' });

  // Issue a short-lived reset token (valid 10 minutes)
  const resetToken = jwt.sign(
    { userId: entry.userId, phone_number, purpose: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

  otpStore.delete(`reset:${phone_number}`);
  res.json({ message: 'OTP verified', resetToken });
};

// ── FORGOT PASSWORD Step 3 — set new password ────────────────────────
const resetPassword = async (req, res) => {
  const { resetToken, new_password } = req.body;
  if (!resetToken || !new_password)
    return res.status(400).json({ message: 'Reset token and new password are required' });
  if (new_password.length < 6)
    return res.status(400).json({ message: 'Password must be at least 6 characters' });

  try {
    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(400).json({ message: 'Reset link expired. Please request a new one.' });
    }

    if (payload.purpose !== 'password_reset')
      return res.status(400).json({ message: 'Invalid reset token' });

    const password_hash = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [password_hash, payload.userId]
    );

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ── Resend reset OTP ─────────────────────────────────────────────────
const resendResetOTP = async (req, res) => {
  const { phone_number } = req.body;
  const key   = `reset:${phone_number}`;
  const entry = otpStore.get(key);
  if (!entry)
    return res.status(400).json({ message: 'No pending reset. Please request again.' });

  const otp = generateOTP();
  otpStore.set(key, { ...entry, otp, expiresAt: Date.now() + 5 * 60 * 1000 });
  await sendSMS(phone_number, otp);
  res.json({ message: 'New OTP sent to your phone.' });
};

// ── Admin: Block ─────────────────────────────────────────────────────
const blockUser = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  if (parseInt(id) === req.user.id)
    return res.status(400).json({ message: 'You cannot block your own account' });
  try {
    const [rows] = await pool.query('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    if (rows[0].role === 'admin') return res.status(400).json({ message: 'Cannot block an admin' });
    await pool.query(
      'UPDATE users SET is_blocked = 1, block_reason = ?, blocked_at = NOW() WHERE id = ?',
      [reason || null, id]
    );
    res.json({ message: 'User blocked successfully' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ── Admin: Unblock ───────────────────────────────────────────────────
const unblockUser = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'UPDATE users SET is_blocked = 0, block_reason = NULL, blocked_at = NULL WHERE id = ?',
      [id]
    );
    res.json({ message: 'User unblocked successfully' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ── Admin: Deactivate temporarily ───────────────────────────────────
const deactivateUser = async (req, res) => {
  const { id } = req.params;
  const { hours, reason } = req.body;
  if (!hours || isNaN(hours) || hours < 1)
    return res.status(400).json({ message: 'Valid hours required (minimum 1)' });
  if (parseInt(id) === req.user.id)
    return res.status(400).json({ message: 'You cannot deactivate your own account' });
  try {
    const [rows] = await pool.query('SELECT id, role FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    if (rows[0].role === 'admin') return res.status(400).json({ message: 'Cannot deactivate an admin' });
    const until = new Date(Date.now() + hours * 3600000);
    await pool.query(
      'UPDATE users SET deactivated_until = ?, block_reason = ? WHERE id = ?',
      [until, reason || `Deactivated for ${hours} hour(s)`, id]
    );
    res.json({ message: `User deactivated until ${until.toLocaleString()}`, until });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ── Admin: Reactivate early ──────────────────────────────────────────
const reactivateUser = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'UPDATE users SET deactivated_until = NULL, block_reason = NULL WHERE id = ?', [id]
    );
    res.json({ message: 'User reactivated successfully' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ── Admin: Permanently delete user ──────────────────────────────────
const adminDeleteUser = async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id)
    return res.status(400).json({ message: 'You cannot delete your own account' });
  try {
    const [rows] = await pool.query('SELECT id, role, name FROM users WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    if (rows[0].role === 'admin') return res.status(400).json({ message: 'Cannot delete an admin' });
    await pool.query('DELETE FROM chat_messages        WHERE user_id = ?', [id]);
    await pool.query('DELETE FROM session_participants WHERE user_id = ?', [id]);
    await pool.query("UPDATE sync_sessions SET status = 'ended' WHERE host_user_id = ?", [id]);
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: `"${rows[0].name}" permanently deleted` });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

// ── User: Delete own account ─────────────────────────────────────────
const deleteAccount = async (req, res) => {
  const { password } = req.body;
  const userId = req.user.id;
  if (!password) return res.status(400).json({ message: 'Password is required' });
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const user = rows[0];
    if (user.role === 'admin')
      return res.status(403).json({ message: 'Admin accounts cannot be self-deleted' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Incorrect password' });
    await pool.query('DELETE FROM chat_messages        WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM session_participants WHERE user_id = ?', [userId]);
    await pool.query("UPDATE sync_sessions SET status = 'ended' WHERE host_user_id = ?", [userId]);
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ message: 'Your account has been permanently deleted' });
  } catch (err) { res.status(500).json({ message: 'Server error' }); }
};

module.exports = {
  signup, login,
  forgotPasswordRequest, forgotPasswordVerifyOTP,
  resetPassword, resendResetOTP,
  blockUser, unblockUser,
  deactivateUser, reactivateUser,
  adminDeleteUser, deleteAccount,
};