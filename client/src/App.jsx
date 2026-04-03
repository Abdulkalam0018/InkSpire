import { Outlet } from "react-router-dom";
import AppHeader from "./components/layout/AppHeader.jsx";

function App() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default App;