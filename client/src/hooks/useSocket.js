import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const URL = 'http://localhost:3003';

export const useSocket = (roomId, username) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [hasNotification, setHasNotification] = useState(false);
  const [notificationTime, setNotificationTime] = useState(null);

  useEffect(() => {
    // Only initialize socket once
    if (!socketRef.current) {
        socketRef.current = io(URL, {
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket', 'polling']
        });

        socketRef.current.on('connect', () => {
            setIsConnected(true);
            console.log('Connected to socket server');
        });

        socketRef.current.on('disconnect', () => {
            setIsConnected(false);
            setIsInRoom(false);
            console.log('Disconnected from socket server');
        });

        // Listen for room join confirmation from server
        socketRef.current.on('notification', (data) => {
            setHasNotification(true);
            setNotificationTime(data.messageTime || Date.now());
        });
        socketRef.current.on('clear-notification', (data) => {
            if (data.userId === socketRef.current.id) {
                setHasNotification(false);
                setNotificationTime(null);
            }
        });
        socketRef.current.on('room-joined', (data) => {
            console.log('Successfully joined room:', data.roomId);
            setIsInRoom(true);
        });
    }

    // Only join room on explicit action (form submission via handleJoinByCode)
    // Don't auto-join on every character typed in the input field
    // Parent component (App.jsx) controls when join happens via setCurrentRoom()
  }, [roomId, username]);
  const sendClearNotification = (roomId) => { if (socketRef.current && roomId) socketRef.current.emit('clear-notification', { roomId }); };
  const sendNotification = (roomId) => { if (socketRef.current && roomId) socketRef.current.emit('notification', { roomId, userId: socketRef.current.id, hasNotification: true, messageTime: Date.now() }); };

  return { socket: socketRef.current, isConnected, isInRoom, hasNotification, notificationTime, sendClearNotification, sendNotification };
};
