const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createGameState, shoot, useItem } = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(path.join(__dirname, 'client')));

const rooms = new Map();

function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.id === socketId)) return room;
  }
  return null;
}

io.on('connection', socket => {
  console.log('[+]', socket.id);
  socket.on('list_rooms', () => {
    const list = [];
    for (const [id, room] of rooms) {
      if (!room.started && room.players.length < 2) {
        list.push({ id, host: room.players[0]?.name, players: room.players.length });
      }
    }
    socket.emit('room_list', list);
  });

  socket.on('create_room', ({ name } = {}) => {
    let roomId;
    do { roomId = uuidv4().slice(0, 6).toUpperCase(); } while (rooms.has(roomId));
    const player = { id: socket.id, name: String(name || '익명').slice(0, 12) };
    rooms.set(roomId, { id: roomId, players: [player], state: null, started: false });
    socket.join(roomId);
    socket.emit('room_created', { roomId, player });
  });

  socket.on('join_room', ({ roomId, name } = {}) => {
    const id = String(roomId || '').toUpperCase();
    const room = rooms.get(id);
    if (!room) return socket.emit('error', '방이 없음');
    if (room.started) return socket.emit('error', '이미 시작된 방');
    if (room.players.length >= 2) return socket.emit('error', '방이 꽉 참');
    const player = { id: socket.id, name: String(name || '익명').slice(0, 12) };
    room.players.push(player);
    socket.join(id);
    socket.emit('room_joined', { roomId: id, player });
    io.to(id).emit('player_joined', { players: room.players });
    if (room.players.length === 2) {
      room.started = true;
      room.state = createGameState(room.players);
      io.to(id).emit('game_start', sanitizeState(room.state, null));
      emitTurnStart(room);
    }
  });

  socket.on('shoot', ({ targetSelf } = {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room?.state || room.state.turn !== socket.id || room.state.phase !== 'playing') return;
    const result = shoot(room.state, socket.id, Boolean(targetSelf));
    io.to(room.id).emit('shot_result', { ...result, state: sanitizeState(room.state, null) });
    if (room.state.phase === 'game_over') io.to(room.id).emit('game_over', { winner: room.state.winner });
    else emitTurnStart(room);
  });

  socket.on('use_item', ({ item } = {}) => {
    const room = getRoomBySocket(socket.id);
    if (!room?.state || room.state.turn !== socket.id || room.state.phase !== 'playing') return;
    const result = useItem(room.state, socket.id, item);
    if (!result.ok) return socket.emit('error', result.msg);
    if (result.reveal) {
      socket.emit('item_used', { ...result, state: sanitizeState(room.state, socket.id) });
      const other = room.players.find(p => p.id !== socket.id);
      if (other) io.to(other.id).emit('item_used', {
        ...result, reveal: null, state: sanitizeState(room.state, other.id),
      });
    } else {
      io.to(room.id).emit('item_used', { ...result, state: sanitizeState(room.state, null) });
    }
    emitTurnStart(room);
  });

  socket.on('request_rematch', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.players.length !== 2) return;
    if (!room.rematchVotes) room.rematchVotes = new Set();
    room.rematchVotes.add(socket.id);
    if (room.rematchVotes.size >= 2) {
      room.rematchVotes.clear();
      room.state = createGameState(room.players);
      room.started = true;
      io.to(room.id).emit('game_start', sanitizeState(room.state, null));
      emitTurnStart(room);
    } else {
      io.to(room.id).emit('rematch_vote', { from: socket.id });
    }
  });

  socket.on('disconnect', () => {
    const room = getRoomBySocket(socket.id);
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      io.to(room.id).emit('player_left', { id: socket.id });
      if (room.players.length === 0) rooms.delete(room.id);
      else { room.started = false; room.state = null; }
    }
    console.log('[-]', socket.id);
  });
});

function emitTurnStart(room) {
  room.players.forEach(player => io.to(player.id).emit('turn_start', {
    currentTurn: room.state.turn,
    state: sanitizeState(room.state, player.id),
  }));
}

function sanitizeState(state, forPlayerId) {
  return {
    phase: state.phase, round: state.round, turn: state.turn,
    knifeActive: state.knifeActive,
    shotgun: { remaining: state.shotgun.shells.length, live: state.shotgun.live, blank: state.shotgun.blank },
    players: state.players.map(p => ({
      id: p.id, name: p.name, hp: p.hp, handcuffed: p.handcuffed,
      itemCount: p.items.length, items: p.id === forPlayerId ? p.items : null,
    })),
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Buckshot Roulette listening on ${PORT}`));
