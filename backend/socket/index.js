const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// In-memory session state
const sessionStates = {};

function initSocket(io) {
  // Auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (e) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.user.name} (${socket.id})`);

    // Join a sync session room
    socket.on('join_session', async ({ session_id }) => {
      socket.join(session_id);
      socket.currentSession = session_id;

      if (!sessionStates[session_id]) {
        // Load from DB
        try {
          const [rows] = await pool.query(
            'SELECT playback_position, status FROM sync_sessions WHERE id = ?',
            [session_id]
          );
          if (rows.length > 0) {
            sessionStates[session_id] = {
              position: rows[0].playback_position,
              status: rows[0].status,
              timestamp: Date.now(),
            };
          } else {
            sessionStates[session_id] = { position: 0, status: 'paused', timestamp: Date.now() };
          }
        } catch (e) {
          sessionStates[session_id] = { position: 0, status: 'paused', timestamp: Date.now() };
        }
      }

      // Send current playback state to newly joined user
      socket.emit('sync_state', sessionStates[session_id]);

      // Notify others
      socket.to(session_id).emit('user_joined', {
        user: { id: socket.user.id, name: socket.user.name },
      });

      console.log(`${socket.user.name} joined session ${session_id}`);
    });

    // Host broadcasts playback updates
    socket.on('playback_update', async ({ session_id, position, status }) => {
      const state = { position, status, timestamp: Date.now() };
      sessionStates[session_id] = state;

      // Broadcast to all others in the room
      socket.to(session_id).emit('sync_state', state);

      // Persist to DB
      try {
        await pool.query(
          'UPDATE sync_sessions SET playback_position = ?, status = ? WHERE id = ?',
          [position, status, session_id]
        );
      } catch (e) {
        console.error('DB update error:', e);
      }
    });

    // Chat messages
    socket.on('send_message', async ({ session_id, message }) => {
      if (!message || !message.trim()) return;

      try {
        const [result] = await pool.query(
          'INSERT INTO chat_messages (session_id, user_id, message) VALUES (?, ?, ?)',
          [session_id, socket.user.id, message.trim()]
        );

        const msgData = {
          id: result.insertId,
          session_id,
          user_id: socket.user.id,
          user_name: socket.user.name,
          message: message.trim(),
          sent_at: new Date().toISOString(),
        };

        // Broadcast to all in room including sender
        io.to(session_id).emit('new_message', msgData);
      } catch (e) {
        console.error('Chat DB error:', e);
      }
    });

    // End session (host only)
    socket.on('end_session', async ({ session_id }) => {
      try {
        await pool.query(
          "UPDATE sync_sessions SET status = 'ended' WHERE id = ?",
          [session_id]
        );
        delete sessionStates[session_id];
      } catch (e) {
        console.error('End session error:', e);
      }

      io.to(session_id).emit('session_ended', { session_id });
      console.log(`Session ${session_id} ended by ${socket.user.name}`);
    });

    // Disconnect cleanup
    socket.on('disconnect', () => {
      if (socket.currentSession) {
        socket.to(socket.currentSession).emit('user_left', {
          user: { id: socket.user.id, name: socket.user.name },
        });
      }
      console.log(`Socket disconnected: ${socket.user.name}`);
    });
  });
}

module.exports = { initSocket };