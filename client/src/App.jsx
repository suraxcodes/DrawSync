import React, { useState, useEffect, useCallback } from 'react';
import Canvas from './components/Canvas';
import Chat from './components/Chat';
import { useSocket } from './hooks/useSocket';
import './App.css';

const WORDS = [
  "Apple","Banana","Car","House","Tree","Pizza","Rocket","Sun","Moon","Star",
  "Cloud","Rain","Snow","Fire","Water","Mountain","River","Beach","Island","Bridge",
  "Road","Train","Airplane","Boat","Bicycle","Bus","Truck","Helmet","Watch","Phone",
  "Laptop","Keyboard","Mouse","Camera","Television","Headphones","Speaker","Lightbulb","Fan","Clock",
  "Book","Pen","Pencil","Eraser","Notebook","Bag","Chair","Table","Bed","Sofa",
  "Door","Window","Key","Lock","Cup","Bottle","Plate","Spoon","Fork","Knife",
  "Cake","Burger","Ice Cream","Donut","Candy","Sandwich","Egg","Fish","Chicken","Pizza Slice",
  "Dog","Cat","Elephant","Lion","Tiger","Horse","Monkey","Bird","Fish Tank","Snake",
  "Butterfly","Bee","Ant","Spider","Dragon","Robot","Alien","Ghost","Zombie","Superhero",
  "Crown","Sword","Shield","Treasure","Castle","Tent","Ball","Football","Basketball","Cricket Bat"
];

const COLORS = [
    '#ff0055', '#ffcc00', '#4caf50', '#009688', '#00bcd4', '#2196f3', '#3f51b5', '#673ab7', '#9c27b0', '#e91e63',
    '#ffffff', '#000000', '#795548', '#ff5722', '#607d8b', '#78909c'
];

const EMOJIS = ['🚀', '🔥', '✨', '💎', '🎨', '🎮', '💡', '❤️', '🌈', '🍕', '🍰', '🐶', '🎉', '🌟', '🦄', '🍎', '👻', '🍦', '🍔'];
const BACKGROUNDS = [
    { id: 'none', name: 'Plain', icon: '⚪' },
    { id: 'grid', name: 'Grid', icon: '🌐' },
    { id: 'paper', name: 'Paper', icon: '📝' },
    { id: 'dots', name: 'Dots', icon: '🎲' },
    { id: 'dark-lines', name: 'Dark Lines', icon: '📓' },
    { id: 'blueprint', name: 'Blueprint', icon: '🏗️' },
    { id: 'cork', name: 'Cork Board', icon: '📌' },
    { id: 'stars', name: 'Space', icon: '🌌' },
    { id: 'chalk', name: 'Chalkboard', icon: '🎓' },
    { id: 'pink-dots', name: 'Pastel', icon: '🌸' }
];

function App() {
  const [color, setColor] = useState('#ff0055');
  const [size, setSize] = useState(5);
  const [opacity, setOpacity] = useState(1);
  const [tool, setTool] = useState('pen');
  const [glow, setGlow] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [currentRoom, setCurrentRoom] = useState('Global');
  const [background, setBackground] = useState('none');
  const [gameState, setGameState] = useState({ active: false, drawer: null, word: '', winner: null });
  const [timeLeft, setTimeLeft] = useState(0);

  const { socket, isConnected, isInRoom } = useSocket(currentRoom, username);

  useEffect(() => {
    let interval;
    if (gameState.active && timeLeft > 0) interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    else if (timeLeft === 0 && gameState.active) setGameState(prev => ({ ...prev, active: false }));
    return () => clearInterval(interval);
  }, [gameState.active, timeLeft]);

  useEffect(() => {
    if (!socket) return;
    socket.on('game-started', (data) => {
        setTimeLeft(data.duration || 60);
        setGameState(prev => {
            const isMe = data.drawerId === socket.id;
            return { ...prev, active: true, drawer: data.drawerId, winner: null, word: isMe ? prev.word : '' };
        });
        if (window.clearDrawingCanvas) window.clearDrawingCanvas();
    });
    socket.on('correct-guess', (data) => {
        setGameState(prev => ({ ...prev, active: false, winner: data.user, word: data.word }));
        setTimeLeft(3);
    });
    socket.on('game-ended', () => { setGameState({ active: false, drawer: null, word: '', winner: null }); setTimeLeft(0); });
    return () => { ['game-started', 'correct-guess', 'game-ended'].forEach(e => socket.off(e)); };
  }, [socket]);

  const handleJoinByCode = (e) => {
    e.preventDefault();
    if (roomId.trim() && username.trim()) {
        const clean = roomId.trim().toUpperCase();
        setCurrentRoom(clean);
        setRoomId(clean);
        // Emit join-room explicitly on form submission only
        if (socket) {
            socket.emit('join-room', { roomId: clean, username: username.trim() });
        }
    }
  };

  const handleStartGame = () => {
      const word = WORDS[Math.floor(Math.random() * WORDS.length)];
      setGameState({ active: true, drawer: socket.id, word, winner: null });
      setTimeLeft(60);
      socket.emit('start-game', { roomId: currentRoom, word });
  };

  const setBrushType = (type) => {
      setTool('pen');
      if (type === 'pencil') { setSize(2); setOpacity(0.5); setGlow(false); }
      else if (type === 'pen') { setSize(5); setOpacity(1); setGlow(false); }
      else if (type === 'brush') { setSize(20); setOpacity(0.8); setGlow(false); }
      else if (type === 'glow') { setSize(15); setOpacity(0.3); setGlow(true); }
  };

  const clearMyWork = () => {
      if (window.clearMyDrawings) window.clearMyDrawings();
  };

  return (
    <div className="App">
      {!isInRoom ? (
        <div className="room-setup-overlay">
            <div className="room-card">
                <h1 className="logo large">DrawSync</h1>
                <p>Collaborate & Compete in real-time.</p>
                <input type="text" placeholder="Enter Nickname" value={username} onChange={(e) => setUsername(e.target.value)} className="username-field" />
                <form onSubmit={handleJoinByCode} className="room-form">
                    <input type="text" placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} />
                    <button type="submit" className="join-btn" disabled={!username.trim()}>Join Room</button>
                    <button type="button" onClick={() => { const code = Math.random().toString(36).substring(2,8).toUpperCase(); setCurrentRoom(code); setRoomId(code); if (socket) socket.emit('join-room', { roomId: code, username: username.trim() }); }} className="create-btn" disabled={!username.trim()}>Create Studio</button>
                </form>
            </div>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <div className="toolbar-left">
                <h1 className="logo">DrawSync</h1>
                <div className="room-badge">{currentRoom} <button className="leave-room" onClick={() => { setCurrentRoom('Global'); setRoomId(''); setUsername(''); }}>×</button></div>
            </div>

            <div className="tool-group">
                <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')} title="Selection Tool">Select</button>
                <div className="divider-v"></div>
                <button className={tool === 'pen' ? 'active' : ''} onClick={() => setTool('pen')}>🖊️ Pen</button>
                <button onClick={() => setBrushType('pencil')}>✏️ Pencil</button>
                <button onClick={() => setBrushType('brush')}>🖌️ Brush</button>
                <button onClick={() => setBrushType('glow')} className={glow ? 'active' : ''}>✨ Glow Brush</button>
                <button className={tool === 'eraser' ? 'active' : ''} onClick={() => setTool('eraser')}>🧽 Eraser</button>
            </div>

            <div className="tool-group">
                <select className="tool-select" onChange={(e) => setTool(e.target.value)} value={['rect', 'circle', 'line', 'triangle', 'diamond'].includes(tool) ? tool : ''}>
                    <option value="" disabled>Shapes</option>
                    <option value="rect">Rectangle</option>
                    <option value="circle">Circle</option>
                    <option value="line">Line</option>
                    <option value="triangle">Triangle</option>
                    <option value="diamond">Diamond</option>
                </select>
                <select className="tool-select" onChange={(e) => setTool(`sticker:${e.target.value}`)} value={tool.startsWith('sticker:') ? tool.split(':')[1] : ''}>
                    <option value="" disabled>Stickers</option>
                    {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <select className="tool-select bg-select" onChange={(e) => setBackground(e.target.value)} value={background}>
                    {BACKGROUNDS.map(bg => <option key={bg.id} value={bg.id}>{bg.icon} {bg.name}</option>)}
                </select>
            </div>

            <div className="tool-group">
                <button className={tool === 'eyedropper' ? 'active' : ''} onClick={() => setTool('eyedropper')}>💧 Pipette</button>
            </div>

            <div className="tool-group">
                <button onClick={clearMyWork} className="clear-work-btn" title="Remove all my drawings">🧹 Clear My Work</button>
                <button onClick={() => window.clearDrawingCanvas && window.clearDrawingCanvas()} className="clear-all-btn">🗑️ Clear All</button>
            </div>

            <div className="tool-group">
                <button onClick={() => window.exportCanvas && window.exportCanvas()} className="export-btn">💾 Export</button>
            </div>
          </div>

          <div className="properties-panel">
                <div className="color-grid">
                    {COLORS.map(c => <button key={c} className={`color-dot ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />)}
                    <input type="color" className="custom-picker" value={color} onChange={(e) => setColor(e.target.value)} title="Mix Custom Color" />
                </div>
                <div className="range-controls">
                    <div className="range-field">
                        <span>Alpha</span>
                        <input type="range" min="0.1" max="1" step="0.1" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
                    </div>
                    <div className="range-field">
                        <span>Size</span>
                        <input type="range" min="1" max="100" value={size} onChange={(e) => setSize(Number(e.target.value))} />
                    </div>
                </div>
                <div className="game-controls">
                    {gameState.active ? (
                        <div className="game-status">
                            <span className="timer-pill">{timeLeft}s</span>
                            {gameState.drawer === socket?.id ? <span className="word-hint">Draw: <strong>{gameState.word}</strong></span> : <span className="guess-hint">Guess!</span>}
                        </div>
                    ) : <button className="start-game-btn" onClick={handleStartGame}>🚀 Start Round</button>}
                </div>
          </div>

          {gameState.winner && <div className="winner-banner">🎉 {gameState.winner} guessed "{gameState.word}"!</div>}

          <div className={`canvas-wrapper bg-${background}`}>
            <Canvas 
                tool={tool} color={color} size={size} opacity={opacity}
                socket={socket} roomId={currentRoom} username={username || 'Guest'}
                glow={glow}
                onColorPick={setColor}
            />
          </div>

          <Chat socket={socket} roomId={currentRoom} username={username || 'Guest'} />
        </>
      )}
    </div>
  );
}

export default App;
