export default function JoinLobbyForm({
  joinCode,
  setJoinCode,
  onJoin,
  onLeave
}) {
  return (
    <div className="card small">
      <h3>Join Lobby</h3>
      <div className="grid">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="Lobby code"
        />
        <button onClick={onJoin}>Join</button>
        <button className="secondary" onClick={onLeave}>
          Leave Current
        </button>
      </div>
    </div>
  );
}
