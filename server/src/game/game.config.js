const DEFAULT_WORD_BANK = ["apple", "river", "mountain", "pencil", "spaceship", "dragon", "guitar", "castle", "meteor", "robot", "island", "flower", "camera", "tiger", "bridge", "planet", "forest", "lighthouse", "piano", "rocket", "ocean", "butterfly", "volcano", "cabin", "rainbow", "desert", "comet", "library", "whisper", "scooter", "anchor", "balloon", "bamboo", "beacon", "beehive", "blizzard", "blueberry", "bonfire", "bookstore", "cactus", "carousel", "cedar", "chameleon", "chimney", "cinnamon", "cliff", "coconut", "compass", "copper", "coral", "cottage", "crater", "crystal", "cupcake", "dandelion", "dolphin", "drizzle", "eagle", "ember", "envelope", "fabric", "falcon", "fossil", "fountain", "galaxy", "garden", "glacier", "glowworm", "granite", "harbor", "hedgehog", "helmet", "horizon", "honeycomb", "jasmine", "jigsaw", "kayak", "kettle", "lantern", "lavender", "lemonade", "lullaby", "magnet", "mango", "marble", "meadow", "midnight", "monsoon", "mosaic", "mushroom", "nebula", "notebook", "oasis", "orchid", "origami", "parachute", "pebble", "pepper", "pinecone", "postcard", "quartz", "quiver", "raincoat", "raspberry", "reef", "riddle", "sapphire", "scarecrow", "seashell", "shadow", "shamrock", "sketch", "snowflake", "sparrow", "starlight", "stonebridge", "sunflower", "sunset", "telescope", "thunder", "timber", "topaz", "torch", "tornado", "tram", "treasure", "tulip", "umbrella", "voyage", "waterfall"];
const MAX_CANVAS_PAYLOAD_SIZE = 250000;

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(numeric, min), max);
}

export function normalizeSettings(raw = {}) {
  const roundDurationSec = clampNumber(raw.roundDurationSec, 60, 20, 180);
  const intermissionSec = clampNumber(raw.intermissionSec, 6, 3, 20);
  const maxRounds = clampNumber(raw.maxRounds, 5, 1, 20);

  const customBank = Array.isArray(raw.wordBank || raw.words)
    ? (raw.wordBank || raw.words)
        .filter((word) => typeof word === "string" && word.trim())
        .map((word) => word.trim().toLowerCase())
    : [];

  return {
    roundDurationSec,
    intermissionSec,
    maxRounds,
    wordBank: customBank.length > 0 ? customBank : DEFAULT_WORD_BANK
  };
}

export function pickWordOptions(wordBank, count = 3) {
  const pool = [...wordBank];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export function normalizeWordInput(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function maskWord(word) {
  if (!word) return null;
  return word
    .split("")
    .map((char) => (char === " " ? " " : "_"))
    .join("");
}

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
