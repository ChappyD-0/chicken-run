import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { GameRoom } from './GameRoom';
import { GameState } from './types';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const room = new GameRoom();

// ── Room → broadcast wiring ───────────────────────────────────────────────────

/** Any phase or player-list change → push full state to everyone */
room.on('stateUpdate', () => {
  io.emit('race:update', room.getGameState());
});

/** Every tick → broadcast race state + send private view to each socket */
room.on('tick', () => {
  io.emit('race:update', room.getGameState());
  for (const [socketId, socket] of io.sockets.sockets) {
    const view = room.getPlayerView(socketId);
    if (view) socket.emit('race:view', view);
  }
});

/** Countdown tick → tell every client which number is showing */
room.on('countdown', (n: number) => {
  io.emit('race:countdown', { value: n });
  io.emit('race:update', room.getGameState());
});

/** Race ended → broadcast final state + winner (if any) */
room.on('raceFinished', (state: GameState) => {
  io.emit('race:update', state);
  io.emit('race:finished', state);
  if (state.winner) {
    io.emit('race:winner', { id: state.winner, name: state.winnerName });
  }
});

/** Collision detail — useful for client-side FX or logging */
room.on('playerCollision', (playerId: string, itemType: string, result: string) => {
  console.log(`[collision] ${playerId} hit ${itemType} → ${result}`);
  // Optionally notify only the affected socket:
  const socket = io.sockets.sockets.get(playerId);
  if (socket) socket.emit('player:collision', { itemType, result });
});

// ── Socket events ─────────────────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // Send current state to the new connection immediately (observer mode)
  socket.emit('race:update', room.getGameState());

  // Admin: request full state at any time without joining as a player
  socket.on('admin:getState', () => {
    socket.emit('race:update', room.getGameState());
  });

  /**
   * player:join  { name, skin }
   * Registers the player and confirms with player:joined.
   */
  socket.on('player:join', (data: { name?: string; skin?: string }) => {
    const name = (data?.name || 'Jugador').slice(0, 20);
    const skin = (data?.skin || 'pollito').slice(0, 30);
    room.addPlayer(socket.id, name, skin);
    socket.emit('player:joined', {
      playerId: socket.id,
      isHost:   room.isHost(socket.id),
      gameState: room.getGameState(),
    });
    io.emit('race:update', room.getGameState());
  });

  /**
   * player:ready
   * Player confirms they are ready to race.
   * The host's "Start" button becomes active once ≥1 player is ready.
   */
  socket.on('player:ready', () => {
    const ok = room.setPlayerReady(socket.id);
    if (ok) {
      console.log(`[ready] ${socket.id}`);
      io.emit('race:update', room.getGameState());
    }
  });

  /**
   * race:start  (host only)
   * Begins the 3-2-1 countdown then the race.
   */
  socket.on('race:start', () => {
    if (room.isHost(socket.id) && room.getGameState().phase === 'waiting') {
      room.startCountdown();
    }
  });

  /**
   * player:input  { lane: 0 | 1 | 2 }
   * Lane change from the player's device.
   */
  socket.on('player:input', (data: { lane: number }) => {
    if (typeof data?.lane === 'number') room.setPlayerLane(socket.id, data.lane);
  });

  /**
   * race:restart  (host only)
   * Resets everything back to waiting state.
   */
  socket.on('race:restart', () => {
    if (room.isHost(socket.id)) room.reset();
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    room.removePlayer(socket.id);
    io.emit('race:update', room.getGameState());
  });
});

// ── Health endpoint ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const state = room.getGameState();
  res.json({
    status:  'ok',
    players: room.getPlayerCount(),
    phase:   state.phase,
    ready:   state.players.filter(p => p.status === 'ready').length,
  });
});

// ── Admin REST endpoints (no auth — local network only) ───────────────────────

/** GET /admin/state — full game state snapshot */
app.get('/admin/state', (_req, res) => {
  res.json(room.getGameState());
});

/** POST /admin/start — force-start the race (ignores host check) */
app.post('/admin/start', (_req, res) => {
  const phase = room.getGameState().phase;
  if (phase !== 'waiting') {
    res.status(409).json({ error: `Cannot start: current phase is "${phase}"` });
    return;
  }
  // Mark all waiting players as ready so startCountdown() threshold is met
  for (const p of room.getGameState().players) {
    if (p.status === 'waiting') room.setPlayerReady(p.id);
  }
  room.startCountdown();
  res.json({ ok: true, message: 'Countdown started' });
});

/** POST /admin/restart — force-reset to waiting state */
app.post('/admin/restart', (_req, res) => {
  room.reset();
  res.json({ ok: true, message: 'Room reset to waiting' });
});

/** POST /admin/kick/:id — remove a player by socket id */
app.post('/admin/kick/:id', (req, res) => {
  const { id } = req.params;
  const socket = io.sockets.sockets.get(id);
  if (!socket) {
    res.status(404).json({ error: 'Socket not found' });
    return;
  }
  socket.disconnect(true);
  res.json({ ok: true, message: `Kicked ${id}` });
});

// ── Start listening on all interfaces (LAN accessible) ────────────────────────
const PORT = process.env.PORT ?? 3000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🐔  Run-Chicken server → http://0.0.0.0:${PORT}`);
  console.log(`   Phones on the same WiFi: http://<your-ip>:${PORT}`);
});
