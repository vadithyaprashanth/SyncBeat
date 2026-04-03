import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGetSongs, apiDeleteAccount } from '../utils/api';
import SongCard from '../components/Player/SongCard';
import { useAuth } from '../context/AuthContext';

// ════════════════════════════════════════
//  Library Page
// ════════════════════════════════════════
export function LibraryPage({ currentSong, onPlay }) {
  const [songs, setSongs]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetSongs()
      .then((res) => setSongs(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Library</h1>
          <p className="page-subtitle">{songs.length} songs available</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading library...</div>
      ) : songs.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📚</span>
          <h3>Library is empty</h3>
          <p>Admin hasn't added songs yet.</p>
        </div>
      ) : (
        <div className="songs-grid">
          {songs.map((song, i) => (
            <SongCard
              key={song.id}
              song={song}
              index={i}
              isPlaying={currentSong?.id === song.id}
              onPlay={onPlay}
              onSync={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════
//  Delete Account Modal
// ════════════════════════════════════════
function DeleteAccountModal({ onClose, onConfirm, loading }) {
  const [password, setPassword]   = useState('');
  const [typed, setTyped]         = useState('');
  const [error, setError]         = useState('');
  const CONFIRM_PHRASE            = 'DELETE MY ACCOUNT';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (typed !== CONFIRM_PHRASE)
      return setError(`Please type exactly: ${CONFIRM_PHRASE}`);
    if (!password)
      return setError('Password is required');
    setError('');
    onConfirm(password);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card delete-modal" onClick={(e) => e.stopPropagation()}>
        {/* Warning header */}
        <div className="delete-modal-header">
          <div className="delete-icon">⚠️</div>
          <h2 className="delete-title">Delete Account Permanently</h2>
          <p className="delete-subtitle">
            This action is <strong>irreversible</strong>. Everything will be gone:
          </p>
          <ul className="delete-list">
            <li>👤 Your profile and login</li>
            <li>💬 All your chat messages</li>
            <li>🔗 Your sync session history</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="delete-form">
          {/* Confirm phrase */}
          <div className="form-group">
            <label>
              Type <strong className="confirm-phrase">{CONFIRM_PHRASE}</strong> to confirm
            </label>
            <input
              type="text"
              placeholder={CONFIRM_PHRASE}
              value={typed}
              onChange={(e) => { setTyped(e.target.value); setError(''); }}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {/* Password */}
          <div className="form-group">
            <label>Enter your password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="auth-error">⚠️ {error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-delete-account"
              disabled={loading || typed !== CONFIRM_PHRASE || !password}
            >
              {loading ? <span className="spinner" /> : '🗑 Delete My Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ════════════════════════════════════════
//  Profile Page
// ════════════════════════════════════════
export function ProfilePage() {
  const { user, logout }            = useAuth();
  const navigate                    = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading]     = useState(false);
  const [deleteError, setDeleteError]         = useState('');

  const handleDeleteConfirm = async (password) => {
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await apiDeleteAccount({ password });
      // Clear session and redirect to auth
      logout();
      navigate('/auth', { state: { deleted: true } });
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to delete account');
      setDeleteLoading(false);
    }
  };

  return (
    <div className="page">
      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => { setShowDeleteModal(false); setDeleteError(''); }}
          onConfirm={handleDeleteConfirm}
          loading={deleteLoading}
          error={deleteError}
        />
      )}

      <div className="page-header">
        <h1 className="page-title">Profile</h1>
      </div>

      <div className="profile-layout">
        {/* ── Profile Card ── */}
        <div className="profile-card">
          <div className="profile-avatar">{user?.name?.[0]?.toUpperCase()}</div>
          <h2 className="profile-name">{user?.name}</h2>
          <span className={`role-badge large ${user?.role}`}>{user?.role}</span>

          <div className="profile-details">
            <div className="profile-field">
              <span className="field-label">📞 Phone</span>
              <span className="field-value">{user?.phone_number}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">🎭 Role</span>
              <span className="field-value" style={{ textTransform: 'capitalize' }}>{user?.role}</span>
            </div>
            <div className="profile-field">
              <span className="field-label">🔐 Session</span>
              <span className="field-value">Active (8h)</span>
            </div>
          </div>

          <div className="profile-bio">
            <p>Welcome to SyncBeat — where music connects people in real-time. Start a sync session and listen together! 🎵</p>
          </div>
        </div>

        {/* ── Danger Zone ── */}
        {user?.role !== 'admin' && (
          <div className="danger-zone-card">
            <div className="danger-zone-header">
              <span className="danger-icon">⚠️</span>
              <div>
                <h3 className="danger-title">Danger Zone</h3>
                <p className="danger-subtitle">Irreversible and destructive actions</p>
              </div>
            </div>

            <div className="danger-action">
              <div className="danger-action-info">
                <h4>Delete Account Permanently</h4>
                <p>
                  Once deleted, your account, messages, and all session data will be
                  removed forever. This cannot be undone.
                </p>
              </div>
              <button
                className="btn-delete-account-trigger"
                onClick={() => setShowDeleteModal(true)}
              >
                🗑 Delete Account
              </button>
            </div>
          </div>
        )}

        {user?.role === 'admin' && (
          <div className="danger-zone-card admin-protected-card">
            <div className="danger-zone-header">
              <span className="danger-icon">🛡️</span>
              <div>
                <h3 className="danger-title">Admin Account</h3>
                <p className="danger-subtitle">
                  Admin accounts are protected and cannot be self-deleted.
                  Contact a super-admin to remove this account.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}