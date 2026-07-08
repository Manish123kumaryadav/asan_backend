const jwt = require("jsonwebtoken");
const { WebSocketServer } = require("ws");

const clientsByUser = new Map();

function addClient(userId, ws) {
  const key = String(userId);
  if (!clientsByUser.has(key)) clientsByUser.set(key, new Set());
  clientsByUser.get(key).add(ws);

  ws.on("close", () => {
    const clients = clientsByUser.get(key);
    if (!clients) return;
    clients.delete(ws);
    if (clients.size === 0) clientsByUser.delete(key);
  });
}

function sendToUser(userId, event, data) {
  const clients = clientsByUser.get(String(userId));
  if (!clients) return;

  const message = JSON.stringify({ event, data });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(message);
  }
}

function attachRealtime(server) {
  const wss = new WebSocketServer({ server, path: "/api/ws" });

  wss.on("connection", (ws, req) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const token = url.searchParams.get("token");
      if (!token) {
        ws.close(1008, "Token required");
        return;
      }

      const user = jwt.verify(token, process.env.JWT_SECRET);
      addClient(user.id, ws);
      ws.send(JSON.stringify({ event: "connected", data: { userId: user.id } }));

      ws.on("message", (payload) => {
        let message;
        try {
          message = JSON.parse(payload.toString());
        } catch {
          return;
        }

        if (message.event === "ping") {
          ws.send(JSON.stringify({ event: "pong", data: { at: new Date().toISOString() } }));
        }
      });
    } catch {
      ws.close(1008, "Invalid token");
    }
  });

  return wss;
}

module.exports = {
  attachRealtime,
  sendToUser,
};
