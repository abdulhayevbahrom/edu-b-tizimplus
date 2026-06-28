export function normalizeUzPhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  let normalized = digits;

  if (normalized.startsWith("998")) {
    normalized = normalized.slice(3);
  } else if (normalized.startsWith("8") && normalized.length === 10) {
    normalized = normalized.slice(1);
  }

  normalized = normalized.slice(0, 9);

  if (normalized.length !== 9) {
    return String(value).trim();
  }

  return `+998${normalized}`;
}
