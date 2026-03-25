import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

const app = express()
app.use(cors())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST']
  }
})

const gameRooms = {}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)

  socket.on('join-room', (data) => {
    const { roomId, username } = data
    socket.username = username
    socket.join(roomId)
    console.log(`User ${socket.id} (${username}) joined room: ${roomId}`)
    socket.emit('room-joined', { roomId, username })
    socket.to(roomId).emit('user-joined', { userId: socket.id, username })
  })

  socket.on('cursor-move', (data) => {
    const { roomId, cursor } = data
    if (roomId) {
      socket.to(roomId).emit('cursor-move', { ...cursor, userId: socket.id })
    }
  })

  socket.on('clear-canvas', (roomId) => {
    if (roomId) socket.to(roomId).emit('clear-canvas')
    else socket.broadcast.emit('clear-canvas')
  })

  socket.on('start-game', (data) => {
    const { roomId, word } = data
    gameRooms[roomId] = {
      drawer: socket.id,
      word: word.toLowerCase().trim(),
      state: 'playing',
      timer: 60
    }
    io.to(roomId).emit('game-started', { drawerId: socket.id, duration: 60 })
  })

  socket.on('object-added', (data) => {
    const { roomId, obj } = data
    if (gameRooms[roomId] && gameRooms[roomId].drawer !== socket.id) return
    if (roomId) socket.to(roomId).emit('object-added', obj)
  })

  socket.on('object-updated', (data) => {
    const { roomId, id, updates } = data
    if (roomId) socket.to(roomId).emit('object-updated', { id, updates })
  })

  socket.on('object-deleted', (data) => {
    const { roomId, id } = data
    if (roomId) socket.to(roomId).emit('object-deleted', id)
  })

  socket.on('chat-message', (data) => {
    const { roomId, message } = data
    const room = gameRooms[roomId]

    if (room && room.state === 'playing' && socket.id !== room.drawer) {
      if (message.text.toLowerCase().trim() === room.word) {
        io.to(roomId).emit('correct-guess', { user: message.sender, word: room.word })
        room.state = 'ended'
        return
      }
    }

    if (roomId) {
      socket.to(roomId).emit('chat-message', { ...message, userId: socket.id })
      socket.to(roomId).emit('notification', {
        userId: socket.id,
        hasNotification: true,
        messageTime: Date.now()
      })
    }
  })

  socket.on('clear-notification', (data) => {
    const { roomId } = data
    if (!roomId) return
    socket.to(roomId).emit('clear-notification', { userId: socket.id })
  })

  socket.on('clear-my-objects', (data) => {
    const { roomId, userId } = data
    if (roomId) socket.to(roomId).emit('clear-my-objects', userId)
  })

  socket.on('disconnecting', () => {
    socket.rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        socket.to(roomId).emit('user-left', socket.id)
        const clients = io.sockets.adapter.rooms.get(roomId)
        if (clients && clients.size === 1) {
          console.log(`Room ${roomId} is now empty. Purging room memory.`)
          delete gameRooms[roomId]
        }
      }
    })
  })

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
    for (const rid in gameRooms) {
      if (gameRooms[rid].drawer === socket.id) {
        console.log(`Drawer left room ${rid}. Ending game.`)
        delete gameRooms[rid]
        io.to(rid).emit('game-ended', { reason: 'drawer-left' })
      }
    }
  })
})

const PORT = process.env.PORT || 3002
httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on http://localhost:${PORT}`)
})