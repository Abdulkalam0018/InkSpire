import { createBrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import Home from "./pages/Home.jsx";
import Game from "./pages/Game.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: (
          // <ProtectedRoute>
            <Home />
          // </ProtectedRoute>
        )
      },
      {
        path: "game",
        element: <Game />
      }
    ]
  }
]);

export default router;
