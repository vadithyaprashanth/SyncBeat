import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGetSongs, apiCreateSession } from '../utils/api';
import SongCard from '../components/Player/SongCard';

export default function Home({ currentSong, onPlay, onSync }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    apiGetSongs()
      .then((res) => setSongs(res.data))
      .catch(() => setError('Failed to load songs'))
      .finally(() => setLoading(false));
  }, []);

  const handleSync = async (song) => {
    try {
      const res = await apiCreateSession({ song_id: song.id });
      navigate(`/sync?session=${res.data.session.id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create session');
    }
  };

  const filtered = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Discover Music</h1>
          <p className="page-subtitle">
            {songs.length} tracks ready to play
          </p>
        </div>
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search songs or artists..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : error ? (
        <div className="error-state">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🎵</span>
          <h3>No songs found</h3>
          <p>{songs.length === 0 ? 'Admin hasn\'t added any songs yet.' : 'Try a different search.'}</p>
        </div>
      ) : (
        <div className="songs-grid">
          {filtered.map((song, index) => (
            <SongCard
              key={song.id}
              song={song}
              index={index}
              isPlaying={currentSong?.id === song.id}
              onPlay={onPlay}
              onSync={() => handleSync(song)}
            />
          ))}
        </div>
      )}
    </div>
  );
}