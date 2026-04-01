import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function Home() {
  const [health, setHealth] = useState(null);
  const [authTest, setAuthTest] = useState(null);
  const [socketMsg, setSocketMsg] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: "error" }));
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch(`${API_BASE}/api/auth/test`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((r) => r.json())
      .then(setAuthTest)
      .catch(() => setAuthTest({ ok: false }));
  }, []);

  useEffect(() => {
    const socket = io(API_BASE, { transports: ["websocket"] });
    socket.on("server:hello", (msg) => setSocketMsg(msg.message));
    socket.emit("client:ping");
    socket.on("server:pong", () => setSocketMsg("pong received"));
    return () => socket.disconnect();
  }, []);

  return (
    <div>
      <h1>Home</h1>
      <pre>Health: {JSON.stringify(health, null, 2)}</pre>
      <pre>Auth Test: {JSON.stringify(authTest, null, 2)}</pre>
      <pre>Socket: {JSON.stringify(socketMsg, null, 2)}</pre>
    </div>
  );
}
