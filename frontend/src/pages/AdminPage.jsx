import React, { useState, useEffect, useCallback } from 'react';
import { apiGetStats, apiGetUsers, apiGetSongs, apiAddSong, apiDeleteSong } from '../utils/api';
import API from '../utils/api';

// ── Action Modal ─────────────────────────────────────────────────────
function ActionModal({ modal, onClose, onConfirm, loading }) {
  const [reason, setReason]   = useState('');
  const [hours, setHours]     = useState(24);

  if (!modal) return null;
  const { type, user } = modal;

  const titles = {
    block:      { icon: '🚫', title: 'Block User',              color: 'var(--red)' },
    deactivate: { icon: '⏸',  title: 'Temporarily Deactivate',  color: 'var(--yellow)' },
    delete:     { icon: '🗑',  title: 'Permanently Delete User', color: 'var(--red)' },
  };
  const { icon, title, color } = titles[type];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon-header" style={{ color }}>
          <span style={{ fontSize: 36 }}>{icon}</span>
          <h3 className="modal-title" style={{ color }}>{title}</h3>
        </div>

        <p className="modal-subtitle">
          {type === 'delete'
            ? <>You are about to <strong>permanently delete</strong> <strong>{user.name}</strong>'s account. All their data will be erased forever. This cannot be undone.</>
            : type === 'block'
            ? <><strong>{user.name}</strong> ({user.phone_number}) will not be able to log in until unblocked.</>
            : <><strong>{user.name}</strong> will be unable to log in for the specified duration.</>
          }
        </p>

        {type === 'deactivate' && (
          <div className="form-group">
            <label>Deactivation Duration</label>
            <div className="hours-picker">
              {[1, 6, 12, 24, 48, 72, 168].map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`hours-btn ${hours === h ? 'active' : ''}`}
                  onClick={() => setHours(h)}
                >
                  {h < 24 ? `${h}h` : `${h/24}d`}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={8760}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              placeholder="Custom hours"
              style={{ marginTop: 8 }}
            />
            <span className="form-hint">
              Until: {new Date(Date.now() + hours * 3600000).toLocaleString()}
            </span>
          </div>
        )}

        {(type === 'block' || type === 'deactivate') && (
          <div className="form-group">
            <label>Reason {type === 'block' ? '(optional)' : '(optional)'}</label>
            <input
              type="text"
              placeholder={type === 'block' ? 'e.g. Violation of terms' : 'e.g. Suspicious activity'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {type === 'delete' && (
          <div className="delete-warning-box">
            <p>⚠️ This will permanently delete:</p>
            <ul>
              <li>Their account and login access</li>
              <li>All their chat messages</li>
              <li>Their sync session history</li>
            </ul>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className={type === 'deactivate' ? 'btn-deactivate' : 'btn-danger'}
            onClick={() => onConfirm({ type, userId: user.id, reason, hours })}
            disabled={loading}
          >
            {loading ? <span className="spinner-sm" /> : `${icon} Confirm`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────
function UserStatus({ user }) {
  if (user.is_blocked) return <span className="status-blocked">🚫 Blocked</span>;
  if (user.deactivated_until && new Date(user.deactivated_until) > new Date()) {
    const until = new Date(user.deactivated_until);
    return (
      <div className="deactivated-status">
        <span className="status-deactivated">⏸ Deactivated</span>
        <span className="deactivated-until">until {until.toLocaleDateString()}</span>
      </div>
    );
  }
  return <span className="status-active">✅ Active</span>;
}

// ── Main AdminPage ────────────────────────────────────────────────────
export default function AdminPage() {
  const [stats, setStats]             = useState(null);
  const [users, setUsers]             = useState([]);
  const [songs, setSongs]             = useState([]);
  const [tab, setTab]                 = useState('overview');
  const [loading, setLoading]         = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [form, setForm]               = useState({ title: '', artist: '', duration_secs: '' });
  const [audioFile, setAudioFile]     = useState(null);
  const [message, setMessage]         = useState('');
  const [modal, setModal]             = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [userSearch, setUserSearch]   = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, uRes, soRes] = await Promise.all([apiGetStats(), apiGetUsers(), apiGetSongs()]);
      setStats(sRes.data);
      setUsers(uRes.data);
      setSongs(soRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddSong = async (e) => {
    e.preventDefault();
    if (!audioFile) return setMessage('Please select an audio file');
    setUploadLoading(true); setMessage('');
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('artist', form.artist);
    fd.append('duration_secs', form.duration_secs || '0');
    fd.append('audio', audioFile);
    try {
      await apiAddSong(fd);
      setMessage('✅ Song added!');
      setForm({ title: '', artist: '', duration_secs: '' }); setAudioFile(null);
      document.getElementById('audio-file-input').value = '';
      fetchData();
    } catch (err) { setMessage('❌ ' + (err.response?.data?.message || 'Upload failed')); }
    finally { setUploadLoading(false); }
  };

  const handleDeleteSong = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await apiDeleteSong(id);
      setSongs((p) => p.filter((s) => s.id !== id));
    } catch (err) { alert(err.response?.data?.message || 'Delete failed'); }
  };

  const handleActionConfirm = async ({ type, userId, reason, hours }) => {
    setActionLoading(true);
    try {
      if (type === 'block') {
        await API.patch(`/admin/users/${userId}/block`, { reason });
        setUsers((p) => p.map((u) => u.id === userId ? { ...u, is_blocked: 1, block_reason: reason } : u));
      } else if (type === 'deactivate') {
        const res = await API.patch(`/admin/users/${userId}/deactivate`, { hours, reason });
        setUsers((p) => p.map((u) => u.id === userId ? { ...u, deactivated_until: res.data.until } : u));
      } else if (type === 'delete') {
        await API.delete(`/admin/users/${userId}`);
        setUsers((p) => p.filter((u) => u.id !== userId));
        if (stats) setStats((s) => ({ ...s, total_users: s.total_users - 1 }));
      }
      setModal(null);
    } catch (err) { alert(err.response?.data?.message || 'Action failed'); }
    finally { setActionLoading(false); }
  };

  const handleUnblock = async (user) => {
    try {
      await API.patch(`/admin/users/${user.id}/unblock`);
      setUsers((p) => p.map((u) => u.id === user.id ? { ...u, is_blocked: 0, block_reason: null } : u));
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const handleReactivate = async (user) => {
    try {
      await API.patch(`/admin/users/${user.id}/reactivate`);
      setUsers((p) => p.map((u) => u.id === user.id ? { ...u, deactivated_until: null } : u));
    } catch (err) { alert(err.response?.data?.message || 'Failed'); }
  };

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.phone_number.includes(userSearch)
  );

  const isDeactivated = (u) => u.deactivated_until && new Date(u.deactivated_until) > new Date();

  const TABS = [
    { id: 'overview',  label: '📊 Overview' },
    { id: 'add-song',  label: '➕ Add Song'  },
    { id: 'songs',     label: '🎵 Songs'     },
    { id: 'users',     label: '👥 Users'     },
  ];

  return (
    <div className="page">
      <ActionModal
        modal={modal}
        onClose={() => setModal(null)}
        onConfirm={handleActionConfirm}
        loading={actionLoading}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">🛡️ Admin Panel</h1>
          <p className="page-subtitle">Manage SyncBeat platform</p>
        </div>
        <button className="btn-ghost" onClick={fetchData}>↻ Refresh</button>
      </div>

      {loading ? <div className="loading-state">Loading...</div> : (
        <>
          {/* Stats */}
          {stats && (
            <div className="stats-row">
              <div className="stat-card">
                <span className="stat-icon">🎵</span>
                <div className="stat-value">{stats.total_songs}</div>
                <div className="stat-label">Total Songs</div>
              </div>
              <div className="stat-card">
                <span className="stat-icon">👥</span>
                <div className="stat-value">{stats.total_users}</div>
                <div className="stat-label">Registered Users</div>
              </div>
              <div className="stat-card">
                <span className="stat-icon">🔗</span>
                <div className="stat-value">{stats.active_sessions}</div>
                <div className="stat-label">Active Sessions</div>
              </div>
              <div className="stat-card blocked-stat">
                <span className="stat-icon">🚫</span>
                <div className="stat-value">{stats.blocked_users || 0}</div>
                <div className="stat-label">Blocked Users</div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="admin-tabs">
            {TABS.map((t) => (
              <button key={t.id} className={`admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Add Song */}
          {tab === 'add-song' && (
            <div className="admin-panel">
              <h2>Add New Song</h2>
              <form className="add-song-form" onSubmit={handleAddSong}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Song Title *</label>
                    <input type="text" placeholder="e.g. Bohemian Rhapsody" required
                      value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Artist *</label>
                    <input type="text" placeholder="e.g. Queen" required
                      value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Duration (seconds)</label>
                    <input type="number" placeholder="e.g. 354" min="0"
                      value={form.duration_secs} onChange={(e) => setForm({ ...form, duration_secs: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Audio File * (MP3, WAV, OGG — max 50MB)</label>
                    <input id="audio-file-input" type="file" accept=".mp3,.wav,.ogg,.m4a,.flac" required className="file-input"
                      onChange={(e) => setAudioFile(e.target.files[0])} />
                  </div>
                </div>
                {message && <div className={`form-message ${message.startsWith('✅') ? 'success' : 'error'}`}>{message}</div>}
                <button type="submit" className="btn-primary" disabled={uploadLoading}>
                  {uploadLoading ? 'Uploading...' : '⬆ Upload Song'}
                </button>
              </form>
            </div>
          )}

          {/* Songs Table */}
          {tab === 'songs' && (
            <div className="admin-panel">
              <h2>All Songs ({songs.length})</h2>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead><tr><th>ID</th><th>Title</th><th>Artist</th><th>Duration</th><th>Added By</th><th>Date</th><th>Action</th></tr></thead>
                  <tbody>
                    {songs.map((song) => (
                      <tr key={song.id}>
                        <td>#{song.id}</td>
                        <td className="td-title">{song.title}</td>
                        <td>{song.artist}</td>
                        <td>{song.duration_secs}s</td>
                        <td>{song.added_by_name || '—'}</td>
                        <td>{new Date(song.created_at).toLocaleDateString()}</td>
                        <td>
                          <button className="btn-delete" onClick={() => handleDeleteSong(song.id, song.title)}>🗑 Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Users Table */}
          {tab === 'users' && (
            <div className="admin-panel">
              <div className="admin-panel-header">
                <h2>All Users ({users.length})</h2>
                <input
                  type="text"
                  className="table-search"
                  placeholder="Search by name or phone..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Phone</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className={u.is_blocked ? 'blocked-row' : isDeactivated(u) ? 'deactivated-row' : ''}>
                        <td>#{u.id}</td>
                        <td className="td-name">
                          <span className="user-initial">{u.name[0]}</span>{u.name}
                        </td>
                        <td>{u.phone_number}</td>
                        <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                        <td><UserStatus user={u} /></td>
                        <td>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          {u.role === 'admin' ? (
                            <span className="admin-protected">🛡️ Protected</span>
                          ) : (
                            <div className="action-btns">
                              {u.is_blocked ? (
                                <button className="btn-unblock" onClick={() => handleUnblock(u)}>✅ Unblock</button>
                              ) : isDeactivated(u) ? (
                                <button className="btn-unblock" onClick={() => handleReactivate(u)}>▶ Reactivate</button>
                              ) : (
                                <>
                                  <button className="btn-block" onClick={() => setModal({ type: 'block', user: u })}>🚫 Block</button>
                                  <button className="btn-deactivate-sm" onClick={() => setModal({ type: 'deactivate', user: u })}>⏸ Pause</button>
                                </>
                              )}
                              <button className="btn-delete" onClick={() => setModal({ type: 'delete', user: u })}>🗑</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Overview */}
          {tab === 'overview' && (
            <div className="admin-overview">
              <div className="overview-card">
                <h3>📊 Platform Summary</h3>
                <p>SyncBeat has <strong>{stats?.total_songs}</strong> songs, <strong>{stats?.total_users}</strong> users, <strong>{stats?.active_sessions}</strong> active sessions, and <strong>{stats?.blocked_users || 0}</strong> blocked accounts.</p>
              </div>
              <div className="overview-card">
                <h3>🕒 Recent Users</h3>
                {users.slice(0, 5).map((u) => (
                  <div key={u.id} className="recent-item">
                    <span className="user-initial">{u.name[0]}</span>
                    <span>{u.name}</span>
                    <span className={`role-badge ${u.role}`}>{u.role}</span>
                    {u.is_blocked && <span className="status-blocked">🚫</span>}
                    {isDeactivated(u) && <span className="status-deactivated">⏸</span>}
                  </div>
                ))}
              </div>
              <div className="overview-card">
                <h3>🎵 Recent Songs</h3>
                {songs.slice(0, 5).map((s) => (
                  <div key={s.id} className="recent-item">
                    <span>🎵</span><span>{s.title} — {s.artist}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}