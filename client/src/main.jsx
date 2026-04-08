import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./router.jsx";
import "./index.css";
import { ClerkProvider } from '@clerk/react'
import { SocketProvider } from "./context/SocketContext.jsx";
import { LobbyProvider } from "./context/LobbyContext.jsx";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key')
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <SocketProvider>
        <LobbyProvider>
          <RouterProvider router={router} />
        </LobbyProvider>
      </SocketProvider>
    </ClerkProvider>
  </React.StrictMode>
);
