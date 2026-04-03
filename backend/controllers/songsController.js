const pool = require('../config/db');
const path = require('path');
const fs = require('fs');

const getSongs = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, u.name as added_by_name
       FROM songs s LEFT JOIN users u ON s.added_by = u.id
       ORDER BY s.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const addSong = async (req, res) => {
  const { title, artist, duration_secs } = req.body;
  if (!title || !artist)
    return res.status(400).json({ message: 'Title and artist required' });

  if (!req.file)
    return res.status(400).json({ message: 'Audio file required' });

  const file_url = `/uploads/${req.file.filename}`;
  const cover_url = null; // Could extend with cover image upload

  try {
    const [result] = await pool.query(
      'INSERT INTO songs (title, artist, file_url, cover_url, duration_secs, added_by) VALUES (?, ?, ?, ?, ?, ?)',
      [title, artist, file_url, cover_url, parseInt(duration_secs) || 0, req.user.id]
    );
    const [rows] = await pool.query('SELECT * FROM songs WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteSong = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT file_url FROM songs WHERE id = ?', [id]);
    if (rows.length === 0)
      return res.status(404).json({ message: 'Song not found' });

    // Delete file from disk
    const filePath = path.join(__dirname, '..', rows[0].file_url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await pool.query('DELETE FROM songs WHERE id = ?', [id]);
    res.json({ message: 'Song deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getSongs, addSong, deleteSong };