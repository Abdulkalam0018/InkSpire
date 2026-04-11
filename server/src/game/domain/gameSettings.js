import { clampNumber } from "../../shared/validation/commonValidators.js";

export const DEFAULT_WORD_BANK = ["apple", "river", "mountain", "pencil", "spaceship", "dragon", "guitar", "castle", "meteor", "robot", "island", "flower", "camera", "tiger", "bridge", "planet", "forest", "lighthouse", "piano", "rocket", "ocean", "butterfly", "volcano", "cabin", "rainbow", "desert", "comet", "library", "whisper", "scooter", "anchor", "balloon", "bamboo", "beacon", "beehive", "blizzard", "blueberry", "bonfire", "bookstore", "cactus", "carousel", "cedar", "chameleon", "chimney", "cinnamon", "cliff", "coconut", "compass", "copper", "coral", "cottage", "crater", "crystal", "cupcake", "dandelion", "dolphin", "drizzle", "eagle", "ember", "envelope", "fabric", "falcon", "fossil", "fountain", "galaxy", "garden", "glacier", "glowworm", "granite", "harbor", "hedgehog", "helmet", "horizon", "honeycomb", "jasmine", "jigsaw", "kayak", "kettle", "lantern", "lavender", "lemonade", "lullaby", "magnet", "mango", "marble", "meadow", "midnight", "monsoon", "mosaic", "mushroom", "nebula", "notebook", "oasis", "orchid", "origami", "parachute", "pebble", "pepper", "pinecone", "postcard", "quartz", "quiver", "raincoat", "raspberry", "reef", "riddle", "sapphire", "scarecrow", "seashell", "shadow", "shamrock", "sketch", "snowflake", "sparrow", "starlight", "stonebridge", "sunflower", "sunset", "telescope", "thunder", "timber", "topaz", "torch", "tornado", "tram", "treasure", "tulip", "umbrella", "voyage", "waterfall"];

export function normalizeGameSettings(raw = {}) {
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
