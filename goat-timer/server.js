const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const rooms = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sanitizeRoomId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 48) || 'meadow';
}

function sanitizeName(value) {
  return String(value || 'Capretta anonima')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 24) || 'Capretta anonima';
}

function clampMinutes(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(180, Math.max(1, Math.round(number)));
}

function createRoom() {
  return {
    workMinutes: 25,
    breakMinutes: 5,
    mode: 'work',
    isRunning: false,
    remainingSeconds: 25 * 60,
    endAt: null,
    version: 0,
    completionTimer: null,
    clients: new Map()
  };
}

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, createRoom());
  return rooms.get(roomId);
}

function publicState(room) {
  let remainingSeconds = room.remainingSeconds;
  if (room.isRunning && room.endAt) {
    remainingSeconds = Math.max(0, Math.ceil((room.endAt - Date.now()) / 1000));
  }

  return {
    workMinutes: room.workMinutes,
    breakMinutes: room.breakMinutes,
    mode: room.mode,
    isRunning: room.isRunning,
    remainingSeconds,
    endAt: room.endAt,
    version: room.version,
    participants: [...room.clients.entries()].map(([id, client]) => ({ id, name: client.name }))
  };
}

function sendEvent(response, eventName, payload) {
  if (!response || response.writableEnded) return;
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(room, eventName, payload, excludedClientId = null) {
  for (const [clientId, client] of room.clients.entries()) {
    if (clientId !== excludedClientId) sendEvent(client.response, eventName, payload);
  }
}

function broadcastState(room) {
  broadcast(room, 'stateUpdated', publicState(room));
}

function clearCompletionTimer(room) {
  if (room.completionTimer) {
    clearTimeout(room.completionTimer);
    room.completionTimer = null;
  }
}

function scheduleCompletion(roomId, room) {
  clearCompletionTimer(room);
  if (!room.isRunning || !room.endAt) return;

  const delay = Math.max(0, room.endAt - Date.now());
  const scheduledVersion = room.version;

  room.completionTimer = setTimeout(() => {
    const latestRoom = rooms.get(roomId);
    if (!latestRoom || latestRoom.version !== scheduledVersion || !latestRoom.isRunning) return;

    latestRoom.isRunning = false;
    latestRoom.remainingSeconds = 0;
    latestRoom.endAt = null;
    latestRoom.version += 1;
    latestRoom.completionTimer = null;

    broadcast(latestRoom, 'timerCompleted', {
      mode: latestRoom.mode,
      state: publicState(latestRoom)
    });
    broadcastState(latestRoom);
  }, delay + 60);
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (body.length > 100_000) {
        reject(new Error('Payload troppo grande'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('JSON non valido'));
      }
    });
    request.on('error', reject);
  });
}

function jsonResponse(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(JSON.stringify(data));
}

function serveStatic(request, response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function handleEventStream(request, response, url) {
  const roomId = sanitizeRoomId(url.searchParams.get('room'));
  const clientId = String(url.searchParams.get('clientId') || crypto.randomUUID()).slice(0, 80);
  const name = sanitizeName(url.searchParams.get('name'));
  const room = ensureRoom(roomId);
  const previousClient = room.clients.get(clientId);

  if (previousClient?.response && !previousClient.response.writableEnded) {
    previousClient.response.end();
  }

  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  response.write(': connected\n\n');

  const isNewParticipant = !previousClient;
  room.clients.set(clientId, { name, response });

  if (isNewParticipant) {
    broadcast(room, 'participantJoined', { id: clientId, name }, clientId);
    broadcastState(room);
  } else {
    sendEvent(response, 'stateUpdated', publicState(room));
  }

  const heartbeat = setInterval(() => {
    if (!response.writableEnded) response.write(': heartbeat\n\n');
  }, 20_000);

  request.on('close', () => {
    clearInterval(heartbeat);
    const currentRoom = rooms.get(roomId);
    if (!currentRoom) return;
    const activeClient = currentRoom.clients.get(clientId);
    if (!activeClient || activeClient.response !== response) return;

    currentRoom.clients.delete(clientId);
    broadcast(currentRoom, 'participantLeft', { id: clientId, name });
    broadcastState(currentRoom);

    if (currentRoom.clients.size === 0 && !currentRoom.isRunning) {
      clearCompletionTimer(currentRoom);
      setTimeout(() => {
        const latestRoom = rooms.get(roomId);
        if (latestRoom && latestRoom.clients.size === 0 && !latestRoom.isRunning) {
          rooms.delete(roomId);
        }
      }, 30 * 60 * 1000);
    }
  });
}

async function handleAction(request, response) {
  try {
    const body = await parseJsonBody(request);
    const roomId = sanitizeRoomId(body.roomId);
    const room = ensureRoom(roomId);

    switch (body.action) {
      case 'toggleTimer':
        if (room.isRunning) {
          room.remainingSeconds = Math.max(0, Math.ceil((room.endAt - Date.now()) / 1000));
          room.isRunning = false;
          room.endAt = null;
          clearCompletionTimer(room);
        } else if (room.remainingSeconds > 0) {
          room.isRunning = true;
          room.endAt = Date.now() + room.remainingSeconds * 1000;
        }
        break;

      case 'resetTimer':
        clearCompletionTimer(room);
        room.isRunning = false;
        room.endAt = null;
        room.remainingSeconds = (room.mode === 'work' ? room.workMinutes : room.breakMinutes) * 60;
        break;

      case 'changeMode':
        if (!['work', 'break'].includes(body.mode)) throw new Error('Modalità non valida');
        clearCompletionTimer(room);
        room.mode = body.mode;
        room.isRunning = false;
        room.endAt = null;
        room.remainingSeconds = (room.mode === 'work' ? room.workMinutes : room.breakMinutes) * 60;
        break;

      case 'updateDurations':
        room.workMinutes = clampMinutes(body.workMinutes, room.workMinutes);
        room.breakMinutes = clampMinutes(body.breakMinutes, room.breakMinutes);
        clearCompletionTimer(room);
        room.isRunning = false;
        room.endAt = null;
        room.remainingSeconds = (room.mode === 'work' ? room.workMinutes : room.breakMinutes) * 60;
        break;

      default:
        throw new Error('Azione non valida');
    }

    room.version += 1;
    scheduleCompletion(roomId, room);
    broadcastState(room);
    jsonResponse(response, 200, { ok: true, state: publicState(room) });
  } catch (error) {
    jsonResponse(response, 400, { ok: false, error: error.message });
  }
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/events') {
    handleEventStream(request, response, url);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/action') {
    handleAction(request, response);
    return;
  }

  if (request.method === 'GET') {
    serveStatic(request, response, url.pathname);
    return;
  }

  response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`Capretta Timer è attivo su http://localhost:${PORT}`);
});
