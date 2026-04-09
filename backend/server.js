require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { initSocket } = require('./socket');

const app = express();
const server = http.createServer(app);

// Socket.io configuration for Serverless compatibility
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Use polling as a fallback since WebSockets can be unstable on some serverless tiers
  transports: ['polling', 'websocket'] 
});

initSocket(io);

// Middleware
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', 
  credentials: true 
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', require('./routes'));

// Health check
app.get('/health', (req, res) => res.json({ 
  status: 'ok', 
  timestamp: new Date(),
  env: process.env.NODE_ENV 
}));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🎵 SyncBeat backend running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
});