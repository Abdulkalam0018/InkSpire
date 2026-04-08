import { useState } from "react";
import CreateLobbyForm, { DEFAULT_MAX_PLAYERS } from "./CreateLobbyForm.jsx";
import JoinLobbyForm from "./JoinLobbyForm.jsx";
import { useLobby } from "../../context/LobbyContext.jsx";

export default function LobbyActionsCard() {
  const { createLobby, joinLobby, leaveLobby, lobbyError } = useLobby();

  const [displayName, setDisplayName] = useState("");
  const [createName, setCreateName] = useState("");
  const [createMaxPlayers, setCreateMaxPlayers] = useState(DEFAULT_MAX_PLAYERS);
  const [createPrivate, setCreatePrivate] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  function handleCreateLobby() {
    createLobby({
      displayName,
      settings: {
        name: createName,
        maxPlayers: Number(createMaxPlayers),
        isPrivate: createPrivate
      }
    });
  }

  function handleJoinLobby() {
    joinLobby({
      lobbyId: joinCode.trim(),
      displayName
    });
  }

  function handleLeaveLobby() {
    leaveLobby();
  }

  return (
    <section className="card">
      <h2>Lobby Actions</h2>

      <div className="grid">
        <label className="field">
          <span>Display name (optional)</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Player name"
          />
        </label>

        <div className="row">
          <CreateLobbyForm
            createName={createName}
            setCreateName={setCreateName}
            createMaxPlayers={createMaxPlayers}
            setCreateMaxPlayers={setCreateMaxPlayers}
            createPrivate={createPrivate}
            setCreatePrivate={setCreatePrivate}
            onCreate={handleCreateLobby}
          />

          <JoinLobbyForm
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            onJoin={handleJoinLobby}
            onLeave={handleLeaveLobby}
          />
        </div>

        {lobbyError ? <div className="error">{lobbyError}</div> : null}
      </div>
    </section>
  );
}
