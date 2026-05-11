import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { GameRoom } from './GameRoom';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const room = new GameRoom();

room.on('stateUpdate', () => {
  io.emit('gameState', room.getGameState());
});

room.on('tick', () => {
  io.emit('gameState', room.getGameState());
  for (const [socketId, socket] of io.sockets.sockets) {
    const view = room.getPlayerView(socketId);
    if (view) socket.emit('playerView', view);
  }
});

io.on('connection', (socket: Socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  socket.on('joinGame', (data: { name?: string }) => {
    const name = (data?.name || 'Jugador').slice(0, 20);
    room.addPlayer(socket.id, name);
    socket.emit('joined', {
      playerId: socket.id,
      isHost: room.isHost(socket.id),
      gameState: room.getGameState(),
    });
    io.emit('gameState', room.getGameState());
  });

  socket.on('startGame', () => {
    if (room.isHost(socket.id) && room.getGameState().phase === 'waiting') {
      room.startCountdown();
    }
  });

  socket.on('movePlayer', (data: { lane: number }) => {
    if (typeof data?.lane === 'number') room.setPlayerLane(socket.id, data.lane);
  });

  socket.on('restartGame', () => {
    if (room.isHost(socket.id)) room.reset();
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    room.removePlayer(socket.id);
    io.emit('gameState', room.getGameState());
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', players: room.getPlayerCount(), phase: room.getGameState().phase });
});

const PORT = process.env.PORT ?? 3000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🐔  Run-Chicken server -> http://0.0.0.0:${PORT}`);
});

