import { useLobby } from "../context/LobbyContext.jsx";
import LobbyGameRedirect from "../components/lobby/LobbyGameRedirect.jsx";
import LobbyStateCard from "../components/lobby/LobbyStateCard.jsx";
import LandingBackdrop from "../components/landing/LandingBackdrop.jsx";
import LandingHero from "../components/landing/LandingHero.jsx";

export default function Home() {
  const { lobbyState } = useLobby();

  return (
    <div className="landing-home">
      <LandingBackdrop />

      <div className="landing-shell">
        <LobbyGameRedirect />

        <div className="landing-stage">
          {lobbyState ? (
            <div key={lobbyState.id} className="landing-state-wrap lobby-state-enter">
              <LobbyStateCard />
            </div>
          ) : (
            <LandingHero />
          )}
        </div>
      </div>
    </div>
  );
}
