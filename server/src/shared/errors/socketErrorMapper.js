import { isAppError } from "./appError.js";

export function toSocketErrorPayload(error, fallbackMessage = "Unexpected error") {
  if (isAppError(error)) {
    return {
      ok: false,
      code: error.code,
      error: error.message,
      details: error.details
    };
  }

  return {
    ok: false,
    code: "INTERNAL_ERROR",
    error: fallbackMessage
  };
}

export function respondWithSocketError({ socket, ack, eventName, error, fallbackMessage }) {
  const payload = toSocketErrorPayload(error, fallbackMessage);

  if (eventName) {
    socket.emit(eventName, payload);
  }

  if (typeof ack === "function") {
    ack(payload);
  }

  return payload;
}
