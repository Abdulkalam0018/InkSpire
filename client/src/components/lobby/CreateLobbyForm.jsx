const DEFAULT_MAX_PLAYERS = 8;

export default function CreateLobbyForm({
  createName,
  setCreateName,
  createMaxPlayers,
  setCreateMaxPlayers,
  createPrivate,
  setCreatePrivate,
  onCreate
}) {
  return (
    <div className="card small">
      <h3>Create Lobby</h3>
      <div className="grid">
        <input
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
          placeholder="Lobby name"
        />
        <input
          type="number"
          min="2"
          max="32"
          value={createMaxPlayers}
          onChange={(e) => setCreateMaxPlayers(e.target.value)}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={createPrivate}
            onChange={(e) => setCreatePrivate(e.target.checked)}
          />
          Private lobby
        </label>
        <button onClick={onCreate}>Create</button>
      </div>
    </div>
  );
}

export { DEFAULT_MAX_PLAYERS };
