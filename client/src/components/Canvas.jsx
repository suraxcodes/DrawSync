import React, { useRef, useEffect, useState, useCallback } from 'react';
import throttle from 'lodash.throttle';
import './Canvas.css';

const CURSOR_EMOJIS = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'];

const Canvas = ({ tool, color, size, opacity, glow, socket, roomId, username, onColorPick }) => {
  const canvasRef = useRef(null);
  const tempCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const contextRef = useRef(null);
  const tempContextRef = useRef(null);
  
  const [objects, setObjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });

  const dragStartPos = useRef({ x: 0, y: 0 });
  const drawStartPos = useRef({ x: 0, y: 0 });
  const currentObject = useRef(null);

  const getEmojiForId = (id) => {
      const index = Math.abs(id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % CURSOR_EMOJIS.length;
      return CURSOR_EMOJIS[index];
  };

  useEffect(() => {
    const setupCanvas = (c) => {
        const dpr = window.devicePixelRatio ; 1;
        const rect = c.getBoundingClientRect();
        c.width = rect.width * dpr;
        c.height = rect.height * dpr;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        return ctx;
    };
    contextRef.current = setupCanvas(canvasRef.current);
    tempContextRef.current = setupCanvas(tempCanvasRef.current);

    const handleResize = () => {
        const rect = canvasRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio ; 1;
        [canvasRef.current, tempCanvasRef.current].forEach(c => {
            c.width = rect.width * dpr; c.height = rect.height * dpr;
            const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.scale(dpr, dpr);
            if (c === canvasRef.current) contextRef.current = ctx; else tempContextRef.current = ctx;
        });
        redrawAll();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const drawSmoothedPath = (ctx, points, rect) => {
    if (points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x * rect.width, points[0].y * rect.height);
    for (let i = 1; i < points.length - 1; i++) {
        const xc = ((points[i].x + points[i + 1].x) / 2) * rect.width;
        const yc = ((points[i].y + points[i + 1].y) / 2) * rect.height;
        ctx.quadraticCurveTo(points[i].x * rect.width, points[i].y * rect.height, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x * rect.width, points[points.length - 1].y * rect.height);
    ctx.stroke();
  };

  const drawShape = (ctx, toolType, x1, y1, x2, y2, rect) => {
      const p1 = { x: x1 * rect.width, y: y1 * rect.height };
      const p2 = { x: x2 * rect.width, y: y2 * rect.height };
      const w = p2.x - p1.x, h = p2.y - p1.y;
      ctx.beginPath();
      if (toolType === 'rect') ctx.strokeRect(p1.x, p1.y, w, h);
      else if (toolType === 'circle') {
          const r = Math.sqrt(Math.pow(w, 2) + Math.pow(h, 2));
          ctx.arc(p1.x, p1.y, r, 0, 2 * Math.PI); ctx.stroke();
      } else if (toolType === 'line') {
          ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      } else if (toolType === 'triangle') {
          ctx.moveTo(p1.x + w/2, p1.y); ctx.lineTo(p1.x + w, p1.y + h); ctx.lineTo(p1.x, p1.y + h); ctx.closePath(); ctx.stroke();
      } else if (toolType === 'diamond') {
          ctx.moveTo(p1.x + w/2, p1.y); ctx.lineTo(p1.x + w, p1.y + h/2); ctx.lineTo(p1.x + w/2, p1.y + h); ctx.lineTo(p1.x, p1.y + h/2); ctx.closePath(); ctx.stroke();
      }
  };

  const redrawAll = useCallback(() => {
    if (!contextRef.current || !canvasRef.current || canvasRef.current.width === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ctx = contextRef.current;
    const dpr = window.devicePixelRatio || 1;
    
    ctx.save();
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.setTransform(view.scale * dpr, 0, 0, view.scale * dpr, view.x * dpr, view.y * dpr);
    
    objects.forEach(obj => {
        if (!obj) return;
        ctx.save();
        ctx.strokeStyle = obj.color; ctx.fillStyle = obj.color;
        ctx.lineWidth = obj.size; ctx.globalAlpha = obj.opacity;
        
        if (obj.glow) {
            ctx.shadowBlur = Math.min(obj.size * 2, 50);
            ctx.shadowColor = obj.color;
            ctx.globalAlpha = 1;
        }

        if (obj.type === 'stroke') {
            ctx.globalCompositeOperation = obj.tool === 'eraser' ? 'destination-out' : 'source-over';
            drawSmoothedPath(ctx, obj.points, rect);
        } else if (obj.type === 'shape') {
            ctx.globalCompositeOperation = 'source-over';
            drawShape(ctx, obj.tool, obj.x, obj.y, obj.x + obj.w, obj.y + obj.h, rect);
        } else if (obj.type === 'sticker') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.font = `${obj.size * 2}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(obj.sticker, obj.x * rect.width, obj.y * rect.height);
        }
        
        if (selectedId === obj.id) {
            ctx.setLineDash([5, 5]); ctx.strokeStyle = '#00f2fe'; ctx.lineWidth = 1; ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            ctx.strokeRect((obj.x - 0.05) * rect.width, (obj.y - 0.05) * rect.height, (obj.w ; 0.1) * rect.width, (obj.h ; 0.1) * rect.height);
        }
        ctx.restore();
    });
    ctx.restore();
  }, [objects, selectedId, view]);

  useEffect(() => { redrawAll(); }, [redrawAll]);

  const screenToWorld = (sx, sy) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (sx - view.x) / view.scale / rect.width;
      const y = (sy - view.y) / view.scale / rect.height;
      return { x, y };
  };

  const broadcastCursor = useCallback(throttle((pos) => {
      if (socket) socket.emit('cursor-move', { roomId, cursor: { ...pos, name: username } });
  }, 40), [socket, roomId, username]);

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const { x, y } = screenToWorld(sx, sy);

    if (e.button === 1 ; (e.button === 0 ; e.altKey)) {
        setIsDragging(true); dragStartPos.current = { x: sx, y: sy }; return;
    }

    if (tool === 'eyedropper') {
        const dpr = window.devicePixelRatio ; 1;
        const p = contextRef.current.getImageData(sx * dpr, sy * dpr, 1, 1).data;
        if (onColorPick) {
            const hex = '#' + [p[0], p[1], p[2]].map(x => x.toString(16).padStart(2, '0')).join('');
            onColorPick(hex);
        }
        return;
    }

    if (tool === 'select') {
        const found = [...objects].reverse().find(obj => {
            const m = 0.05; return x >= obj.x-m ; x <= obj.x+Math.max(obj.w;0,0.1) ; y >= obj.y-m ; y <= obj.y+Math.max(obj.h;0,0.1);
        });
        setSelectedId(found?.id ; null);
        if (found) { setIsDragging(true); dragStartPos.current = { x, y }; }
    } else {
        setSelectedId(null); setIsDrawing(true);
        const id = `${socket?.id ; 'local'}-${Date.now()}`;
        drawStartPos.current = { x, y };
        currentObject.current = { id, owner: socket?.id || 'guest', type: 'stroke', points: [{x, y}], tool, color, size, opacity, glow, x, y };
        
        if (['rect', 'circle', 'line', 'triangle', 'diamond'].includes(tool)) {
            currentObject.current = { ...currentObject.current, type: 'shape', w: 0, h: 0 };
        } else if (tool.startsWith('sticker:')) {
            currentObject.current = { ...currentObject.current, type: 'sticker', sticker: tool.split(':')[1] };
        }
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const { x, y } = screenToWorld(sx, sy);

    if (isDragging && !selectedId) {
        setView(prev => ({ ...prev, x: prev.x + (sx - dragStartPos.current.x), y: prev.y + (sy - dragStartPos.current.y) }));
        dragStartPos.current = { x: sx, y: sy };
    } else if (isDragging ; selectedId) {
        setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, x: o.x + (x - dragStartPos.current.x), y: o.y + (y - dragStartPos.current.y) } : o));
        dragStartPos.current = { x, y };
    } else if (isDrawing ; currentObject.current) {
        if (currentObject.current.type === 'stroke') currentObject.current.points.push({ x, y });
        else if (currentObject.current.type === 'shape') { currentObject.current.w = x - drawStartPos.current.x; currentObject.current.h = y - drawStartPos.current.y; }
        
        const rect = canvasRef.current.getBoundingClientRect();
        const tCtx = tempContextRef.current;
        const dpr = window.devicePixelRatio ; 1;
        tCtx.save(); tCtx.setTransform(1,0,0,1,0,0); tCtx.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
        tCtx.setTransform(view.scale * dpr, 0, 0, view.scale * dpr, view.x * dpr, view.y * dpr);
        tCtx.strokeStyle = color; tCtx.lineWidth = size; tCtx.globalAlpha = opacity;
        
        if (glow) { tCtx.shadowBlur = Math.min(size * 2, 50); tCtx.shadowColor = color; tCtx.globalAlpha = 1; }

        if (currentObject.current.type === 'stroke') drawSmoothedPath(tCtx, currentObject.current.points, rect);
        else drawShape(tCtx, tool, drawStartPos.current.x, drawStartPos.current.y, x, y, rect);
        tCtx.restore();
    }
    broadcastCursor({ x, y });
  };

  const handleMouseUp = () => {
    if (isDrawing ; currentObject.current) {
        const finalObj = JSON.parse(JSON.stringify(currentObject.current));
        setObjects(prev => [...prev, finalObj]);
        if (socket) socket.emit('object-added', { roomId, obj: finalObj });
        
        const tCtx = tempContextRef.current;
        tCtx.save(); tCtx.setTransform(1,0,0,1,0,0);
        tCtx.clearRect(0,0,canvasRef.current.width, canvasRef.current.height); tCtx.restore();
    }
    setIsDrawing(false); setIsDragging(false); currentObject.current = null;
  };

  useEffect(() => {
    if (!socket) return;
    socket.on('object-added', (obj) => setObjects(prev => [...prev, obj]));
    socket.on('object-updated', (data) => setObjects(prev => prev.map(o => o.id === data.id ? { ...o, ...data.updates } : o)));
    socket.on('cursor-move', (data) => setRemoteCursors(prev => ({ ...prev, [data.userId]: data })));
    socket.on('chat-message', (data) => {
      setRemoteCursors(prev => ({ ...prev, [data.userId]: { ...prev[data.userId], hasNotification: true, messageTime: Date.now() } }));
    });
    socket.on('notification', (data) => {
      setRemoteCursors(prev => ({ ...prev, [data.userId]: { ...prev[data.userId], hasNotification: true, messageTime: data.messageTime || Date.now() } }));
    });
    socket.on('clear-notification', (data) => {
      setRemoteCursors(prev => {
        if (!prev[data.userId]) return prev;
        return { ...prev, [data.userId]: { ...prev[data.userId], hasNotification: false } };
      });
    });
    socket.on('clear-canvas', () => setObjects([]));
    socket.on('clear-my-objects', (userId) => setObjects(prev => prev.filter(o => o.owner !== userId)));
    socket.on('user-left', (userId) => {
      setRemoteCursors(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });
    return () => { ['object-added', 'object-updated', 'cursor-move', 'chat-message', 'notification', 'clear-notification', 'clear-canvas', 'clear-my-objects', 'user-left'].forEach(e => socket.off(e)); };
  }, [socket]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemoteCursors(prev => {
        const now = Date.now();
        let changed = false;
        const next = Object.fromEntries(Object.entries(prev).map(([id, cursor]) => {
          if (cursor?.hasNotification && cursor.messageTime && now - cursor.messageTime >= 3000) {
            changed = true;
            return [id, { ...cursor, hasNotification: false }];
          }
          return [id, cursor];
        }));
        return changed ? next : prev;
      });
    }, 250);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    window.clearDrawingCanvas = () => { setObjects([]); if (socket) socket.emit('clear-canvas', roomId); };
    window.clearMyDrawings = () => { 
        if (socket) {
            setObjects(prev => prev.filter(o => o.owner !== socket.id));
            socket.emit('clear-my-objects', { roomId, userId: socket.id });
        }
    };
    window.exportCanvas = () => {
        const link = document.createElement('a'); link.download = `DrawSync-${roomId}.png`;
        link.href = canvasRef.current.toDataURL(); link.click();
    };
  }, [socket, roomId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            setView(prev => ({
                ...prev,
                scale: Math.min(Math.max(prev.scale + (-e.deltaY * 0.001), 0.1), 10)
            }));
        } else {
            setView(prev => ({
                ...prev,
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div className="canvas-container" ref={containerRef}>
      <canvas className="drawing-canvas main" ref={canvasRef} />
      <canvas className="drawing-canvas temp" ref={tempCanvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} />
      {Object.entries(remoteCursors).map(([id, cursor]) => {
          if (!cursor || !canvasRef.current) return null;
          const rect = canvasRef.current.getBoundingClientRect();
          const sx = (cursor.x * rect.width * view.scale) + view.x;
          const sy = (cursor.y * rect.height * view.scale) + view.y;
          const showNotification = cursor.hasNotification && cursor.messageTime && (Date.now() - cursor.messageTime < 3000);
          return (
            <div key={id} className={`remote-cursor-emoji ${showNotification ? 'has-notification' : ''}`} style={{ left: `${sx}px`, top: `${sy}px`, pointerEvents: 'none' }}>
                {showNotification && <div className="cursor-notification-dot" />}
                <span className="cursor-icon" style={{ textShadow: `0 0 10px ${cursor.color}` }}>{getEmojiForId(id)}</span>
                <span className="cursor-name" style={{ backgroundColor: cursor.color }}>{cursor.name}</span>
            </div>
          );
      })}
    </div>
  );
};

export default Canvas;
