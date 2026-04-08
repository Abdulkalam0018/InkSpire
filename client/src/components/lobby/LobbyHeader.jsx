import { useLobby } from "../../context/LobbyContext.jsx";

export default function LobbyHeader() {
  const { socketStatus, socketId } = useLobby();

  return (
    <header className="page-header">
      <div>
        <h1>InkSpire Lobby</h1>
        <p className="subtitle">
          Create or join a lobby, then manage settings in real time.
        </p>
      </div>
      <div className="status-pill">
        Socket: {socketStatus} {socketId ? `(${socketId.slice(0, 6)})` : ""}
      </div>
    </header>
  );
}
