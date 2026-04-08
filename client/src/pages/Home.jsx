import LobbyHeader from "../components/lobby/LobbyHeader.jsx";
import LobbyActionsCard from "../components/lobby/LobbyActionsCard.jsx";
import LobbyStateCard from "../components/lobby/LobbyStateCard.jsx";
import LobbyGameRedirect from "../components/lobby/LobbyGameRedirect.jsx";

export default function Home() {
  return (
    <div className="page">
      <LobbyGameRedirect />
      <LobbyHeader />
      <LobbyActionsCard />
      <LobbyStateCard />
    </div>
  );
}
