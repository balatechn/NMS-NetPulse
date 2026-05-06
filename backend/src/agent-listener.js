/**
 * Tacitine EN6200 NMS Agent Listener — TCP port 2133
 *
 * The Tacitine firewall NMS Agent connects TO this server
 * and authenticates using the pre-shared secret.
 *
 * Protocol: We listen on TCP port 2133 and also expose an HTTP endpoint
 * on the same port (via an http server that upgrades to raw TCP as needed).
 * All incoming data is logged and stored as agent events.
 */

const net = require('net');
const http = require('http');
const { broadcast } = require('./routes/ws');

const AGENT_PORT = parseInt(process.env.AGENT_PORT || '2133');
const PRE_SHARED_SECRET = process.env.AGENT_SECRET || 'ab01970c-0444ff4a-7a144966-b31ca1c4';

// Store authenticated sessions: socket → { device info }
const sessions = new Map();

function verifySecret(secret) {
  return secret && secret.trim() === PRE_SHARED_SECRET.trim();
}

async function storeEvent(db, deviceInfo, eventType, payload) {
  try {
    await db.query(
      `INSERT INTO agent_events (source_ip, device_id, event_type, payload, received_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [deviceInfo.ip || null, deviceInfo.device_id || null, eventType, JSON.stringify(payload)]
    );

    // Update or upsert device status if device_id is known
    if (deviceInfo.device_id) {
      const status = payload.status || payload.state || 'up';
      const latency = payload.latency || payload.rtt || null;
      await db.query(
        `INSERT INTO device_status (device_id, status, latency_ms, sys_descr)
         VALUES ($1, $2, $3, $4)`,
        [deviceInfo.device_id, status, latency, payload.sys_descr || payload.description || null]
      );
    }

    broadcast({ type: 'agent_event', data: { ...deviceInfo, eventType, payload }, time: new Date().toISOString() });
  } catch (e) {
    // Log silently — don't crash on DB errors
    console.error('[Agent] DB error:', e.message);
  }
}

async function findOrRegisterDevice(db, ip, info) {
  // Try to match by IP
  const { rows } = await db.query('SELECT id FROM devices WHERE ip_address=$1 LIMIT 1', [ip]);
  if (rows[0]) return rows[0].id;

  // Auto-register device from agent connection
  const name = info.hostname || info.name || `Tacitine-${ip}`;
  const { rows: inserted } = await db.query(
    `INSERT INTO devices (name, ip_address, type, location, snmp_community)
     VALUES ($1, $2, 'firewall', 'Auto-discovered', $3) RETURNING id`,
    [name, ip, process.env.SNMP_DEFAULT_COMMUNITY || 'NATIONAL852']
  );
  console.log(`[Agent] Auto-registered device: ${name} (${ip}) id=${inserted[0].id}`);
  return inserted[0].id;
}

// ── TCP Handler ───────────────────────────────────────────────────────────────
function handleTCPSocket(socket, db) {
  const clientIp = socket.remoteAddress?.replace('::ffff:', '') || 'unknown';
  let authenticated = false;
  let deviceId = null;
  let buffer = '';

  console.log(`[Agent] TCP connection from ${clientIp}`);

  socket.setTimeout(300000); // 5 min timeout
  socket.on('timeout', () => socket.destroy());
  socket.on('error', () => {});

  socket.on('data', async (chunk) => {
    buffer += chunk.toString();

    // Process line-by-line (newline-delimited JSON)
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // last partial line stays in buffer

    for (const line of lines) {
      const raw = line.trim();
      if (!raw) continue;

      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        // Not JSON — treat as raw string
        msg = { raw };
      }

      // First message must contain the secret for auth
      if (!authenticated) {
        const secret = msg.secret || msg.pre_shared_secret || msg.key || msg.token || msg.auth;
        if (verifySecret(secret)) {
          authenticated = true;
          const info = { hostname: msg.hostname || msg.name, version: msg.version };
          deviceId = await findOrRegisterDevice(db, clientIp, info).catch(() => null);
          sessions.set(socket, { ip: clientIp, device_id: deviceId });

          // Send ACK
          socket.write(JSON.stringify({ status: 'ok', message: 'Authenticated' }) + '\n');
          console.log(`[Agent] ${clientIp} authenticated, device_id=${deviceId}`);
        } else {
          socket.write(JSON.stringify({ status: 'error', message: 'Authentication failed' }) + '\n');
          socket.destroy();
          return;
        }
        continue;
      }

      // Authenticated — process telemetry
      const eventType = msg.type || msg.event || 'telemetry';
      await storeEvent(db, { ip: clientIp, device_id: deviceId }, eventType, msg);
    }
  });

  socket.on('close', () => {
    sessions.delete(socket);
    if (authenticated) console.log(`[Agent] ${clientIp} disconnected`);
  });
}

// ── HTTP Handler (device may use HTTP POST to push data) ─────────────────────
function handleHTTP(req, res, db) {
  const clientIp = req.socket.remoteAddress?.replace('::ffff:', '') || 'unknown';
  let body = '';

  req.on('data', (chunk) => { body += chunk; });
  req.on('end', async () => {
    // Auth check from headers or body
    const authHeader = req.headers['x-pre-shared-key']
      || req.headers['authorization']?.replace('Bearer ', '')
      || req.headers['x-agent-secret'];

    let payload = {};
    try { payload = JSON.parse(body); } catch { payload = { raw: body }; }

    const secretFromBody = payload.secret || payload.pre_shared_secret || payload.key;
    const secret = authHeader || secretFromBody;

    if (!verifySecret(secret)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: 'Unauthorized' }));
      return;
    }

    const info = { hostname: payload.hostname || payload.name };
    const deviceId = await findOrRegisterDevice(db, clientIp, info).catch(() => null);
    const eventType = payload.type || payload.event || req.url?.replace('/', '') || 'telemetry';

    await storeEvent(db, { ip: clientIp, device_id: deviceId }, eventType, payload);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', received: true }));

    // Update device status to UP (it's talking to us)
    if (deviceId) {
      db.query(
        `INSERT INTO device_status (device_id, status, latency_ms) VALUES ($1,'up',NULL)`,
        [deviceId]
      ).catch(() => {});
    }
  });
}

// ── Start Listener ────────────────────────────────────────────────────────────
function startAgentListener(db) {
  // Create a combined TCP+HTTP server
  // The same port can handle raw TCP and HTTP connections
  const server = net.createServer((socket) => {
    let firstByte = true;
    let peeked = Buffer.alloc(0);

    socket.once('data', (chunk) => {
      peeked = chunk;

      // Detect HTTP by first bytes
      const firstLine = chunk.slice(0, 8).toString();
      if (firstLine.startsWith('GET ') || firstLine.startsWith('POST ') || firstLine.startsWith('PUT ')) {
        // It's HTTP — hand off to HTTP handler
        const req = new (require('http').IncomingMessage)(socket);
        const res = new (require('http').ServerResponse)(req);

        // Re-inject the chunk into the socket stream
        // Use http.createServer to parse the HTTP request
        const httpServer = http.createServer((req, res) => handleHTTP(req, res, db));
        httpServer.emit('connection', socket);
        socket.unshift(chunk);
      } else {
        // Raw TCP — re-emit the data and continue
        handleTCPSocket(socket, db);
        socket.emit('data', chunk);
      }
    });
  });

  // Actually, let's use a simpler approach: separate HTTP and TCP servers on port 2133
  // Use an HTTP server that also handles upgrade requests
  const httpServer = http.createServer((req, res) => handleHTTP(req, res, db));

  httpServer.on('connection', (socket) => {
    // For non-HTTP TCP connections, the http.Server won't parse them correctly
    // We handle this in the request handler
  });

  httpServer.listen(AGENT_PORT, '0.0.0.0', () => {
    console.log(`[Agent] Listener ready on :${AGENT_PORT} (HTTP mode)`);
  });

  httpServer.on('error', (err) => {
    console.error('[Agent] Listener error:', err.message);
  });

  // Also handle raw TCP upgrades for WebSocket-like connections
  httpServer.on('upgrade', (req, socket, head) => {
    // Re-use TCP handler for raw TCP upgrade connections
    const clientIp = socket.remoteAddress?.replace('::ffff:', '') || 'unknown';
    console.log(`[Agent] TCP upgrade from ${clientIp}`);
    handleTCPSocket(socket, db);
    if (head && head.length) socket.emit('data', head);
  });

  return httpServer;
}

module.exports = { startAgentListener };
