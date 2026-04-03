import React, { useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useSocket } from './hooks/useSocket';
import Sidebar from './components/Layout/Sidebar';
import PlayerBar from './components/Player/PlayerBar';
import Auth from './pages/Auth';
import Home from './pages/Home';
import SyncPage from './pages/SyncPage';
import { LibraryPage, ProfilePage } from './pages/Library';
import AdminPage from './pages/AdminPage';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-loading"><div className="loading-spinner" /><p>Loading SyncBeat...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth();
  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, token } = useAuth();
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [syncMode, setSyncMode] = useState(false);
  const [syncSessionId, setSyncSessionId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [syncState, setSyncState] = useState(null);
  const { emit } = useSocket(token);

  const handlePlay = useCallback((song) => {
    if (currentSong?.id === song.id) {
      setIsPlaying((p) => !p);
    } else {
      setCurrentSong(song);
      setIsPlaying(true);
      setSyncMode(false);
      setSyncSessionId(null);
    }
  }, [currentSong]);

  const handlePlaySync = useCallback((song, sessionId, hostFlag) => {
    if (!song) {
      setSyncMode(false);
      setSyncSessionId(null);
      setIsHost(false);
      return;
    }
    setCurrentSong(song);
    setIsPlaying(true);
    setSyncMode(true);
    setSyncSessionId(sessionId);
    setIsHost(hostFlag);
  }, []);

  const handleSyncStateChange = useCallback((state) => {
    setSyncState(state);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (syncMode && isHost && syncSessionId) {
      const newPlaying = !isPlaying;
      setIsPlaying(newPlaying);
      emit('playback_update', {
        session_id: syncSessionId,
        position: 0, // PlayerBar will handle actual position
        status: newPlaying ? 'active' : 'paused',
      });
    } else {
      setIsPlaying((p) => !p);
    }
  }, [isPlaying, syncMode, isHost, syncSessionId, emit]);

  const handleSeek = useCallback((position) => {
    if (syncMode && isHost && syncSessionId) {
      emit('playback_update', {
        session_id: syncSessionId,
        position,
        status: isPlaying ? 'active' : 'paused',
      });
    }
  }, [syncMode, isHost, syncSessionId, isPlaying, emit]);

  const handleSyncToggle = useCallback(() => {
    if (syncMode) {
      setSyncMode(false);
      setSyncSessionId(null);
    }
  }, [syncMode]);

  if (!user && window.location.pathname !== '/auth') {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <div className={`app-layout ${currentSong ? 'has-player' : ''}`}>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <>
                <Sidebar />
                <main className="main-content">
                  <Routes>
                    <Route path="/" element={<Home currentSong={currentSong} onPlay={handlePlay} />} />
                    <Route
                      path="/sync"
                      element={
                        <SyncPage
                          onPlaySync={handlePlaySync}
                          onSyncStateChange={handleSyncStateChange}
                        />
                      }
                    />
                    <Route path="/library" element={<LibraryPage currentSong={currentSong} onPlay={handlePlay} />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route
                      path="/admin"
                      element={
                        <AdminRoute>
                          <AdminPage />
                        </AdminRoute>
                      }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
                {currentSong && (
                  <PlayerBar
                    song={currentSong}
                    isPlaying={isPlaying}
                    onPlayPause={handlePlayPause}
                    onEnded={() => setIsPlaying(false)}
                    syncMode={syncMode}
                    syncState={syncState}
                    onSeek={handleSeek}
                    onSyncToggle={handleSyncToggle}
                    isHost={isHost}
                  />
                )}
              </>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}