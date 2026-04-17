import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLobby } from "../../context/LobbyContext.jsx";

export default function LobbyGameRedirect() {
  const { lastGameState } = useLobby();
  const navigate = useNavigate();

  useEffect(() => {
    if (!lastGameState) return;
    const activeGameStatuses = new Set(["presenter-choosing", "in-round", "round-ended"]);
    if (activeGameStatuses.has(lastGameState.status)) {
      navigate("/game");
    }
  }, [lastGameState, navigate]);

  return null;
}
