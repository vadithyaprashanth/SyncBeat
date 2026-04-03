import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiGetSessions, apiCreateSession, apiJoinSession } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';

export default function SyncPage({ onPlaySync, onSyncStateChange }) {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chatEndRef = useRef(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { emit, on, off } = useSocket(token);

  const autoJoinId = searchParams.get('session');

  const fetchSessions = useCallback(async () => {
    try {
      const res = await apiGetSessions();
      setSessions(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  // Socket listeners
  useEffect(() => {
    const handleSyncState = (state) => {
      onSyncStateChange && onSyncStateChange(state);
    };
    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };
    const handleUserJoined = ({ user: u }) => {
      setParticipants((prev) => {
        if (prev.find((p) => p.id === u.id)) return prev;
        return [...prev, u];
      });
    };
    const handleUserLeft = ({ user: u }) => {
      setParticipants((prev) => prev.filter((p) => p.id !== u.id));
    };
    const handleSessionEnded = () => {
      alert('The host ended this session.');
      leaveSession();
    };

    on('sync_state', handleSyncState);
    on('new_message', handleNewMessage);
    on('user_joined', handleUserJoined);
    on('user_left', handleUserLeft);
    on('session_ended', handleSessionEnded);

    return () => {
      off('sync_state', handleSyncState);
      off('new_message', handleNewMessage);
      off('user_joined', handleUserJoined);
      off('user_left', handleUserLeft);
      off('session_ended', handleSessionEnded);
    };
  }, [on, off, onSyncStateChange]);

  // Auto-join if ?session= param
  useEffect(() => {
    if (autoJoinId && !activeSession) {
      joinSession(autoJoinId);
    }
  }, [autoJoinId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const joinSession = async (id) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiJoinSession(id);
      const { session, messages: msgs, participants: parts } = res.data;
      setActiveSession(session);
      setMessages(msgs);
      setParticipants(parts);

      // Tell socket to join room
      emit('join_session', { session_id: id });

      // Start playing the song
      onPlaySync && onPlaySync(
        {
          id: session.song_id,
          title: session.song_title,
          artist: session.artist,
          file_url: session.file_url,
          cover_url: session.cover_url,
          duration_secs: session.duration_secs,
        },
        session.id,
        session.host_user_id === user.id
      );

      // Remove query param
      navigate('/sync', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (songId) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiCreateSession({ song_id: songId, invite_phone: invitePhone || undefined });
      const { session } = res.data;
      await joinSession(session.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const leaveSession = () => {
    setActiveSession(null);
    setMessages([]);
    setParticipants([]);
    onPlaySync && onPlaySync(null, null, false);
    onSyncStateChange && onSyncStateChange(null);
    fetchSessions();
  };

  const endSession = () => {
    if (!activeSession) return;
    emit('end_session', { session_id: activeSession.id });
    leaveSession();
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeSession) return;
    emit('send_message', { session_id: activeSession.id, message: chatInput });
    setChatInput('');
  };

  const isHost = activeSession && activeSession.host_user_id === user.id;

  if (activeSession) {
    return (
      <div className="page">
        <div className="sync-session-layout">
          <div className="sync-main">
            <div className="session-header">
              <div className="live-badge">
                <span className="live-dot" />
                LIVE SESSION
              </div>
              <h2 className="session-song-title">{activeSession.song_title}</h2>
              <p className="session-artist">{activeSession.artist}</p>
              <div className="session-meta">
                <span className="participants-count">👥 {participants.length} listening</span>
                {isHost && <span className="host-badge">👑 You are the host</span>}
              </div>
            </div>

            <div className="waveform-display">
              {[...Array(40)].map((_, i) => (
                <div
                  key={i}
                  className="waveform-bar"
                  style={{ '--h': Math.random() * 60 + 20, '--delay': i * 0.05 }}
                />
              ))}
            </div>

            <div className="participants-row">
              <h4>Participants</h4>
              <div className="participants-list">
                {participants.map((p) => (
                  <div key={p.id} className="participant-chip">
                    <span className="participant-avatar">{p.name[0]}</span>
                    <span>{p.name}</span>
                    {p.id === activeSession.host_user_id && <span className="crown">👑</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="session-actions">
              {isHost ? (
                <button className="btn-danger" onClick={endSession}>
                  ⏹ End Session
                </button>
              ) : (
                <button className="btn-secondary" onClick={leaveSession}>
                  ← Leave Session
                </button>
              )}
              <div className="share-session">
                <span className="share-label">Session ID:</span>
                <code className="session-id-code">{activeSession.id.slice(0, 8)}...</code>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(activeSession.id);
                    alert('Session ID copied!');
                  }}
                >
                  📋 Copy
                </button>
              </div>
            </div>
          </div>

          <div className="sync-chat">
            <div className="chat-header">
              <span>💬 Live Chat</span>
              <span className="chat-count">{messages.length} messages</span>
            </div>
            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="chat-empty">No messages yet. Say hi! 👋</div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-message ${msg.user_id === user.id ? 'mine' : ''}`}
                >
                  {msg.user_id !== user.id && (
                    <span className="msg-author">{msg.user_name}</span>
                  )}
                  <div className="msg-bubble">{msg.message}</div>
                  <span className="msg-time">
                    {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form className="chat-input-row" onSubmit={sendMessage}>
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={500}
              />
              <button type="submit" className="btn-send">➤</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sync Sessions</h1>
          <p className="page-subtitle">Listen together in perfect sync</p>
        </div>
      </div>

      <div className="sync-intro-grid">
        <div className="sync-invite-card">
          <h3>🔗 Join by Session ID</h3>
          <p>Have a session ID? Paste it here to join directly.</p>
          <div className="join-form">
            <input
              type="text"
              placeholder="Paste session ID..."
              id="manual-join-id"
            />
            <button
              className="btn-primary"
              onClick={() => {
                const id = document.getElementById('manual-join-id').value.trim();
                if (id) joinSession(id);
              }}
            >
              Join →
            </button>
          </div>
        </div>

        <div className="sync-invite-card">
          <h3>📞 Invite by Phone</h3>
          <p>Enter a friend's phone number to invite them when creating a session.</p>
          <input
            type="tel"
            placeholder="Friend's phone number"
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="error-banner">⚠️ {error}</div>}

      <div className="sessions-section">
        <h2 className="section-title">
          Active Sessions
          <button className="btn-ghost-sm" onClick={fetchSessions}>↻ Refresh</button>
        </h2>

        {sessions.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🔇</span>
            <h3>No active sessions</h3>
            <p>Go to Discover, play a song and hit 🔗 Sync to start one!</p>
          </div>
        ) : (
          <div className="sessions-list">
            {sessions.map((session) => (
              <div key={session.id} className="session-card">
                <div className="session-card-art">🎵</div>
                <div className="session-card-info">
                  <h3>{session.song_title}</h3>
                  <p>{session.artist}</p>
                  <div className="session-card-meta">
                    <span>👑 {session.host_name}</span>
                    <span>👥 {session.participant_count} listening</span>
                    <span className={`status-dot ${session.status}`}>{session.status}</span>
                  </div>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => joinSession(session.id)}
                  disabled={loading}
                >
                  {loading ? '...' : 'Join →'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}