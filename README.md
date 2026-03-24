# Collaborative Drawing Website

A real-time, multi-user drawing application.

## Quick Start

### 1. Start the Backend Server
```bash
cd server
npm install
npm run dev
```
The server will run on `http://localhost:3001`.

### 2. Start the React Frontend
```bash
cd client
npm install
npm run dev
```
The client will run on `http://localhost:5173`.

## Features
- **Real-time Collaboration**: Draw with friends in the same room.
- **Room System**: Private drawing rooms with auto-generated codes.
- **Drawing Tools**: Pen, Eraser, Color Picker, and Brush Size.
- **History**: Undo and Redo support.
- **Optimized**: Throttled drawing events for low latency.

## Tech Stack
- **Frontend**: React, Vite, Socket.io-client, HTML5 Canvas.
- **Backend**: Node.js, Express, Socket.io.
