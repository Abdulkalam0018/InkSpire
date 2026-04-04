import "dotenv/config";
import http from "http";
import initSocket from "./socket/index.js";
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();

  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);
  app.set("io", io);

  httpServer.listen(PORT, () => {
    console.log(`API listening on ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
