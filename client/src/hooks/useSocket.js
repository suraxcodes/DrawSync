import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';

export const useSocket = (roomId, username) => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);

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
        socketRef.current.on('room-joined', (data) => {
            console.log('Successfully joined room:', data.roomId);
            setIsInRoom(true);
        });
    }

    // Handle room switching separately
    if (socketRef.current && roomId && username) {
        setIsInRoom(false); // Reset to false until confirmed
        if (socketRef.current.connected) {
            socketRef.current.emit('join-room', { roomId, username });
        } else {
            // Wait for connection to join
            const joinOnConnect = () => {
                socketRef.current.emit('join-room', { roomId, username });
                socketRef.current.off('connect', joinOnConnect);
            };
            socketRef.current.on('connect', joinOnConnect);
        }
    }

    // Cleanup on unmount or roomId change?
    // Actually, we don't want to disconnect it every time roomId changes.
    // We just want to 'emit' the join.
  }, [roomId, username]);

  return { socket: socketRef.current, isConnected, isInRoom };
};
