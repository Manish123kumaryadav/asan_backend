const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

let io;

function allowedOrigin(origin) {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, "");
  const configured = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""));
  return configured.includes(normalized) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalized);
}

function attachRealtime(server) {
  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        callback(allowedOrigin(origin) ? null : new Error("Origin not allowed"), allowedOrigin(origin));
      },
      methods: ["GET", "POST"],
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error("Token required"));
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch {
      return next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.emit("connected", { userId: socket.user.id });
    socket.on("ping", (callback) => {
      if (typeof callback === "function") callback({ at: new Date().toISOString() });
    });
  });

  return io;
}

function sendToUser(userId, event, data) {
  if (io && userId) io.to(`user:${userId}`).emit(event, data);
}

module.exports = { attachRealtime, sendToUser };
