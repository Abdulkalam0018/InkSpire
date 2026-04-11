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
