import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export const useSocket = (token) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    if (socketInstance && socketInstance.connected) {
      socketRef.current = socketInstance;
      return;
    }

    const socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => console.log('Socket connected:', socket.id));
    socket.on('disconnect', () => console.log('Socket disconnected'));
    socket.on('connect_error', (err) => console.error('Socket error:', err.message));

    socketRef.current = socket;
    socketInstance = socket;

    return () => {
      // Don't disconnect on unmount — keep alive across pages
    };
  }, [token]);

  const emit = useCallback((event, data) => {
    if (socketRef.current) socketRef.current.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    if (socketRef.current) socketRef.current.on(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    if (socketRef.current) socketRef.current.off(event, handler);
  }, []);

  return { socket: socketRef.current, emit, on, off };
};