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

export function getRevealableIndices(word) {
  if (!word) return [];

  const indices = [];
  for (let index = 0; index < word.length; index += 1) {
    if (word[index] !== " ") {
      indices.push(index);
    }
  }

  return indices;
}

export function pickHintRevealOrder(word) {
  const indices = getRevealableIndices(word);
  const shuffled = [...indices];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

export function buildHintMask(word, revealedIndices = []) {
  if (!word) return null;

  const revealedSet = new Set(revealedIndices);

  return word
    .split("")
    .map((char, index) => {
      if (char === " ") return " ";
      return revealedSet.has(index) ? char : "_";
    })
    .join("");
}
