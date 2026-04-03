import React from 'react';

const SONG_EMOJIS = ['🎸', '🎹', '🎺', '🎻', '🥁', '🎷', '🎤', '🎧', '🎼', '🎵', '🎶', '🌟'];
const CARD_COLORS = [
  'linear-gradient(135deg, #1a0533 0%, #3d0b6b 100%)',
  'linear-gradient(135deg, #0d1f3c 0%, #1a3a5c 100%)',
  'linear-gradient(135deg, #1a0a1a 0%, #4a0a3a 100%)',
  'linear-gradient(135deg, #0a1a0a 0%, #0a3a1a 100%)',
  'linear-gradient(135deg, #1a1a0a 0%, #3a2a00 100%)',
  'linear-gradient(135deg, #0a1a1a 0%, #003a3a 100%)',
];

function formatDuration(secs) {
  if (!secs) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SongCard({ song, onPlay, onSync, isPlaying, index = 0 }) {
  const emoji = SONG_EMOJIS[index % SONG_EMOJIS.length];
  const bg = CARD_COLORS[index % CARD_COLORS.length];

  return (
    <div className={`song-card ${isPlaying ? 'playing' : ''}`} onClick={() => onPlay(song)}>
      <div className="song-card-art" style={{ background: bg }}>
        <span className="song-emoji">{emoji}</span>
        {isPlaying && (
          <div className="playing-indicator">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      <div className="song-card-info">
        <h3 className="song-title">{song.title}</h3>
        <p className="song-artist">{song.artist}</p>
        <div className="song-meta">
          <span className="song-duration">{formatDuration(song.duration_secs)}</span>
          <button
            className="sync-btn"
            onClick={(e) => { e.stopPropagation(); onSync(song); }}
            title="Start sync session"
          >
            🔗 Sync
          </button>
        </div>
      </div>
    </div>
  );
}