const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const getSessions = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ss.*, u.name as host_name, s.title as song_title, s.artist,
              COUNT(sp.id) as participant_count
       FROM sync_sessions ss
       JOIN users u ON ss.host_user_id = u.id
       JOIN songs s ON ss.song_id = s.id
       LEFT JOIN session_participants sp ON ss.id = sp.session_id
       WHERE ss.status != 'ended'
       GROUP BY ss.id
       ORDER BY ss.started_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const createSession = async (req, res) => {
  const { song_id, invite_phone } = req.body;
  if (!song_id) return res.status(400).json({ message: 'song_id required' });

  try {
    const [songs] = await pool.query('SELECT id FROM songs WHERE id = ?', [song_id]);
    if (songs.length === 0) return res.status(404).json({ message: 'Song not found' });

    const session_id = uuidv4();
    await pool.query(
      'INSERT INTO sync_sessions (id, host_user_id, song_id) VALUES (?, ?, ?)',
      [session_id, req.user.id, song_id]
    );
    await pool.query(
      'INSERT INTO session_participants (session_id, user_id) VALUES (?, ?)',
      [session_id, req.user.id]
    );

    let invited_user = null;
    if (invite_phone) {
      const [users] = await pool.query(
        'SELECT id, name, phone_number FROM users WHERE phone_number = ?', [invite_phone]
      );
      if (users.length > 0) invited_user = users[0];
    }

    const [sessionRows] = await pool.query(
      `SELECT ss.*, u.name as host_name, s.title as song_title, s.artist,
              s.file_url, s.cover_url, s.duration_secs
       FROM sync_sessions ss
       JOIN users u ON ss.host_user_id = u.id
       JOIN songs s ON ss.song_id = s.id
       WHERE ss.id = ?`,
      [session_id]
    );
    res.status(201).json({ session: sessionRows[0], invited_user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const joinSession = async (req, res) => {
  const { id } = req.params;
  try {
    const [sessions] = await pool.query(
      `SELECT ss.*, s.title as song_title, s.artist, s.file_url, s.cover_url, s.duration_secs
       FROM sync_sessions ss JOIN songs s ON ss.song_id = s.id
       WHERE ss.id = ? AND ss.status != 'ended'`,
      [id]
    );
    if (sessions.length === 0)
      return res.status(404).json({ message: 'Session not found or ended' });

    const [existing] = await pool.query(
      'SELECT id FROM session_participants WHERE session_id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (existing.length === 0) {
      await pool.query(
        'INSERT INTO session_participants (session_id, user_id) VALUES (?, ?)',
        [id, req.user.id]
      );
    }

    const [messages] = await pool.query(
      `SELECT cm.*, u.name as user_name FROM chat_messages cm
       JOIN users u ON cm.user_id = u.id
       WHERE cm.session_id = ? ORDER BY cm.sent_at ASC`,
      [id]
    );
    const [participants] = await pool.query(
      `SELECT u.id, u.name, u.phone_number FROM session_participants sp
       JOIN users u ON sp.user_id = u.id WHERE sp.session_id = ?`,
      [id]
    );

    res.json({ session: sessions[0], messages, participants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAdminStats = async (req, res) => {
  try {
    const [[{ total_songs }]]    = await pool.query('SELECT COUNT(*) as total_songs FROM songs');
    const [[{ total_users }]]    = await pool.query('SELECT COUNT(*) as total_users FROM users');
    const [[{ active_sessions }]]= await pool.query("SELECT COUNT(*) as active_sessions FROM sync_sessions WHERE status != 'ended'");
    const [[{ blocked_users }]]  = await pool.query('SELECT COUNT(*) as blocked_users FROM users WHERE is_blocked = 1');
    res.json({ total_songs, total_users, active_sessions, blocked_users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAdminUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, phone_number, role, is_blocked, block_reason, blocked_at, created_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getSessions, createSession, joinSession, getAdminStats, getAdminUsers };