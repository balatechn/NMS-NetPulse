// WebSocket route - real-time device status push
const clients = new Set();

module.exports = async function wsRoutes(app) {
  app.get('/live', { websocket: true }, (socket, req) => {
    clients.add(socket);
    socket.on('close', () => clients.delete(socket));
    socket.send(JSON.stringify({ type: 'connected', time: new Date().toISOString() }));
  });
};

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    try { client.send(msg); } catch {}
  }
}

module.exports.broadcast = broadcast;
