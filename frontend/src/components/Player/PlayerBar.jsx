import React, { useRef, useEffect, useState } from 'react';

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerBar({
  song,
  isPlaying,
  onPlayPause,
  onEnded,
  syncMode,
  syncState,
  onSeek,
  onSyncToggle,
  isHost,
  onTimeUpdate,
}) {
  const audioRef    = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [volume, setVolume]           = useState(0.8);
  const lastSyncRef = useRef(null);

  // ── Load new song ──────────────────────────────────────
  useEffect(() => {
    if (song && audioRef.current) {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
      audioRef.current.src = backendUrl + song.file_url;
      audioRef.current.load();
      setCurrentTime(0);
      setDuration(0);
    }
    // Added 'song' to dependencies to satisfy ESLint/Vercel build
  }, [song]);

  // ── Play / Pause ───────────────────────────────────────
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // ── Apply sync state (non-host only) ──────────────────
  useEffect(() => {
    if (!syncMode || !syncState || !audioRef.current || isHost) return;
    const elapsed      = (Date.now() - syncState.timestamp) / 1000;
    const targetPos    = syncState.position + (syncState.status === 'active' ? elapsed : 0);
    const drift        = Math.abs(audioRef.current.currentTime - targetPos);

    if (drift > 1) {
      audioRef.current.currentTime = targetPos;
      lastSyncRef.current = targetPos;
    }
    if (syncState.status === 'active' && audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
    } else if (syncState.status !== 'active' && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, [syncState, syncMode, isHost]);

  // ── Volume ────────────────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ── Handlers ─────────────────────────────────────────
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);
    if (onTimeUpdate) onTimeUpdate(t);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e) => {
    const pct     = parseFloat(e.target.value) / 100;
    const newTime = pct * (duration || 0);
    if (audioRef.current) audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    if (syncMode && isHost && onSeek) onSeek(newTime);
  };

  const handleSkip = (delta) => {
    if (!audioRef.current) return;
    const newTime = Math.min(Math.max(0, audioRef.current.currentTime + delta), duration || 0);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    if (syncMode && isHost && onSeek) onSeek(newTime);
  };

  // Guard against NaN progress
  const progress = duration && !isNaN(duration) ? (currentTime / duration) * 100 : 0;

  if (!song) return null;

  return (
    <div className="player-bar">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
      />

      {/* Song info */}
      <div className="player-song-info">
        <div className="player-song-emoji">🎵</div>
        <div>
          <div className="player-song-title">{song.title}</div>
          <div className="player-song-artist">{song.artist}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="player-controls">
        <button className="player-btn" onClick={() => handleSkip(-10)} title="Back 10s">⏮</button>
        <button className="player-play-btn" onClick={onPlayPause}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="player-btn" onClick={() => handleSkip(10)} title="Forward 10s">⏭</button>
      </div>

      {/* Progress bar */}
      <div className="player-progress-section">
        <span className="time-label">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={isNaN(progress) ? 0 : progress}
          onChange={handleSeek}
          className="progress-bar"
        />
        <span className="time-label">{formatTime(duration)}</span>
      </div>

      {/* Volume + Sync toggle */}
      <div className="player-right">
        <span>🔊</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
          className="volume-slider"
        />
        <button
          className={`sync-toggle ${syncMode ? 'active' : ''}`}
          onClick={onSyncToggle}
          title={syncMode ? 'In sync mode — click to leave' : 'Start a sync session'}
        >
          {syncMode ? '🔗 SYNCED' : '🔗 SYNC'}
        </button>
      </div>
    </div>
  );
}