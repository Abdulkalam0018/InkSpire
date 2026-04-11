export const MAX_CANVAS_PAYLOAD_SIZE = 250000;

export function normalizeCanvasState(rawCanvas) {
  if (rawCanvas === undefined || rawCanvas === null) {
    return { canvas: null };
  }

  let parsed = rawCanvas;

  if (typeof parsed === "string") {
    if (!parsed.trim()) {
      return { error: "Canvas data is empty" };
    }
    if (parsed.length > MAX_CANVAS_PAYLOAD_SIZE) {
      return { error: "Canvas payload too large" };
    }

    try {
      parsed = JSON.parse(parsed);
    } catch {
      return { error: "Canvas payload is invalid JSON" };
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "Canvas payload must be an object" };
  }

  let serialized;
  try {
    serialized = JSON.stringify(parsed);
  } catch {
    return { error: "Canvas payload cannot be serialized" };
  }

  if (!serialized || serialized.length > MAX_CANVAS_PAYLOAD_SIZE) {
    return { error: "Canvas payload too large" };
  }

  try {
    return { canvas: JSON.parse(serialized) };
  } catch {
    return { error: "Canvas payload is invalid" };
  }
}
