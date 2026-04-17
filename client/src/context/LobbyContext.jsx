import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { useSocket } from "./SocketContext.jsx";

const LobbyContext = createContext(null);
const DEFAULT_MAX_PLAYERS = 8;

function normalizeLobbyId(lobbyId) {
	if (typeof lobbyId !== "string") return "";
	return lobbyId.trim().toUpperCase();
}

export function LobbyProvider({ children }) {
	const { socket, isConnected, isReconnecting, connectionError } = useSocket();
	const { userId: authUserId } = useAuth();

	const [lobbyState, setLobbyState] = useState(null);
	const [lobbyError, setLobbyError] = useState(null);
	const [lastGameState, setLastGameState] = useState(null);

	useEffect(() => {
		if (!socket) return;

		const handleDisconnect = () => {
			setLobbyState(null);
			setLastGameState(null);
		};

		const handleLobbyState = (state) => {
			setLobbyState(state || null);
			setLobbyError(null);
		};

		const handleLobbyLeft = () => {
			setLobbyState(null);
			setLastGameState(null);
			setLobbyError(null);
		};

		const handleLobbyError = (err) => {
			setLobbyError(err?.message || "Lobby error");
		};

		const handleLobbyKicked = (payload = {}) => {
			setLobbyState(null);
			setLastGameState(null);
			setLobbyError(payload?.reason || "You were removed from the lobby");
		};

		const handleGameState = (state) => {
			setLastGameState(state || null);
		};

		socket.on("disconnect", handleDisconnect);
		socket.on("lobby:state", handleLobbyState);
		socket.on("lobby:left", handleLobbyLeft);
		socket.on("lobby:kicked", handleLobbyKicked);
		socket.on("lobby:error", handleLobbyError);
		socket.on("game:state", handleGameState);

		return () => {
			socket.off("disconnect", handleDisconnect);
			socket.off("lobby:state", handleLobbyState);
			socket.off("lobby:left", handleLobbyLeft);
			socket.off("lobby:kicked", handleLobbyKicked);
			socket.off("lobby:error", handleLobbyError);
			socket.off("game:state", handleGameState);
		};
	}, [socket]);

	useEffect(() => {
		if (!socket || !lobbyState?.id) return;
		// Best-effort sync to fetch current game state after joining/creating a lobby.
		socket.emit("game:sync");
	}, [socket, lobbyState?.id]);

	const emitWithAck = useCallback(
		(event, payload = {}) =>
			new Promise((resolve) => {
				if (!socket || !isConnected) {
					const error = "Socket not connected";
					setLobbyError(error);
					resolve({ ok: false, error });
					return;
				}

				socket.emit(event, payload, (res) => {
					if (res?.ok === false) {
						setLobbyError(res?.error || "Lobby error");
					} else {
						setLobbyError(null);
					}
					resolve(res || { ok: true });
				});
			}),
		[socket, isConnected]
	);

	const createLobby = useCallback(
		({ displayName = "", settings = {} } = {}) => {
			return emitWithAck("lobby:create", {
				displayName,
				settings: {
					name: settings.name || "",
					maxPlayers: Number(settings.maxPlayers ?? DEFAULT_MAX_PLAYERS),
					isPrivate: Boolean(settings.isPrivate)
				}
			});
		},
		[emitWithAck]
	);

	const joinLobby = useCallback(
		({ lobbyId = "", displayName = "" } = {}) => {
			return emitWithAck("lobby:join", {
				lobbyId: normalizeLobbyId(lobbyId),
				displayName
			});
		},
		[emitWithAck]
	);

	const leaveLobby = useCallback(() => {
		return emitWithAck("lobby:leave");
	}, [emitWithAck]);

	const kickMember = useCallback(
		({ lobbyId, userId, reason = "" } = {}) => {
			return emitWithAck("lobby:kick", {
				lobbyId: normalizeLobbyId(lobbyId || lobbyState?.id),
				userId,
				reason
			});
		},
		[emitWithAck, lobbyState?.id]
	);

	const updateLobbySettings = useCallback(
		({ lobbyId, settings = {} } = {}) => {
			return emitWithAck("lobby:updateSettings", {
				lobbyId: normalizeLobbyId(lobbyId || lobbyState?.id),
				settings: {
					name: settings.name || "",
					maxPlayers: Number(settings.maxPlayers ?? DEFAULT_MAX_PLAYERS),
					isPrivate: Boolean(settings.isPrivate)
				}
			});
		},
		[emitWithAck, lobbyState?.id]
	);

	const startGame = useCallback(
		({ lobbyId, force = false } = {}) => {
			return emitWithAck("game:start", {
				lobbyId: normalizeLobbyId(lobbyId || lobbyState?.id),
				force
			});
		},
		[emitWithAck, lobbyState?.id]
	);

	const stopGame = useCallback(
		({ lobbyId } = {}) => {
			return emitWithAck("game:stop", {
				lobbyId: normalizeLobbyId(lobbyId || lobbyState?.id)
			});
		},
		[emitWithAck, lobbyState?.id]
	);

	const syncGame = useCallback(() => {
		return emitWithAck("game:sync");
	}, [emitWithAck]);

	const clearLobbyError = useCallback(() => {
		setLobbyError(null);
	}, []);

	const resolvedLobbyError = lobbyError || connectionError;
	
	const isAdmin =
		Boolean(lobbyState) && Boolean(authUserId) && lobbyState.adminUserId === authUserId;

	const value = useMemo(
		() => ({
			lobbyState,
			lobbyError: resolvedLobbyError,
			setLobbyError,
			clearLobbyError,
			isAdmin,
			lastGameState,
			socketStatus: isConnected ? "connected" : isReconnecting ? "reconnecting" : "disconnected",
			socketId: socket?.id || null,
			createLobby,
			joinLobby,
			leaveLobby,
			kickMember,
			updateLobbySettings,
			startGame,
			stopGame,
			syncGame
		}),
		[
			lobbyState,
			resolvedLobbyError,
			isAdmin,
			lastGameState,
			isConnected,
			isReconnecting,
			socket,
			createLobby,
			joinLobby,
			leaveLobby,
			kickMember,
			updateLobbySettings,
			startGame,
			stopGame,
			syncGame,
			clearLobbyError
		]
	);

	return <LobbyContext.Provider value={value}>{children}</LobbyContext.Provider>;
}

export function useLobby() {
	const context = useContext(LobbyContext);
	if (!context) {
		throw new Error("useLobby must be used within a LobbyProvider");
	}
	return context;
}
