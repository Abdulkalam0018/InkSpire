import "dotenv/config";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log("socket connected", socket.id);
    socket.emit("server:hello", { message: "Hello from server" });
    socket.on("client:ping", () => socket.emit("server:pong"));
  });

  server.listen(PORT, () => {
    console.log(`API listening on ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
