import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLobby } from "../../context/LobbyContext.jsx";

export default function LobbyGameRedirect() {
  const { lastGameState } = useLobby();
  const navigate = useNavigate();

  useEffect(() => {
    if (!lastGameState) return;
    if (lastGameState.status && lastGameState.status !== "idle") {
      navigate("/game");
    }
  }, [lastGameState, navigate]);

  return null;
}
