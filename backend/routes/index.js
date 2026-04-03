const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const {
  signup, login,
  forgotPasswordRequest, forgotPasswordVerifyOTP,
  resetPassword, resendResetOTP,
  blockUser, unblockUser,
  deactivateUser, reactivateUser,
  adminDeleteUser, deleteAccount,
} = require('../controllers/authController');

const { getSongs, addSong, deleteSong } = require('../controllers/songsController');
const { getSessions, createSession, joinSession,
        getAdminStats, getAdminUsers }  = require('../controllers/sessionsController');

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename:    (req, file, cb) =>
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
    allowed.includes(path.extname(file.originalname).toLowerCase())
      ? cb(null, true) : cb(new Error('Only audio files allowed'));
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Auth ──────────────────────────────────────────────────────────────
router.post('/auth/signup',                 signup);
router.post('/auth/login',                  login);
router.post('/auth/forgot-password',        forgotPasswordRequest);
router.post('/auth/forgot-password/verify', forgotPasswordVerifyOTP);
router.post('/auth/reset-password',         resetPassword);
router.post('/auth/resend-reset-otp',       resendResetOTP);
router.delete('/auth/account',              verifyToken, deleteAccount);

// ── Songs ─────────────────────────────────────────────────────────────
router.get('/songs',        verifyToken,               getSongs);
router.post('/songs',       verifyToken, requireAdmin, upload.single('audio'), addSong);
router.delete('/songs/:id', verifyToken, requireAdmin, deleteSong);

// ── Sessions ──────────────────────────────────────────────────────────
router.get('/sessions',           verifyToken, getSessions);
router.post('/sessions',          verifyToken, createSession);
router.post('/sessions/:id/join', verifyToken, joinSession);

// ── Admin ─────────────────────────────────────────────────────────────
router.get('/admin/stats',                    verifyToken, requireAdmin, getAdminStats);
router.get('/admin/users',                    verifyToken, requireAdmin, getAdminUsers);
router.patch('/admin/users/:id/block',        verifyToken, requireAdmin, blockUser);
router.patch('/admin/users/:id/unblock',      verifyToken, requireAdmin, unblockUser);
router.patch('/admin/users/:id/deactivate',   verifyToken, requireAdmin, deactivateUser);
router.patch('/admin/users/:id/reactivate',   verifyToken, requireAdmin, reactivateUser);
router.delete('/admin/users/:id',             verifyToken, requireAdmin, adminDeleteUser);

module.exports = router;