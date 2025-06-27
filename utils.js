export function parseCommand(text) {
  if (!text.toLowerCase().startsWith('bb')) return null;
  const parts = text.trim().split(/\s+/);
  return {
    cmd: parts[1]?.toLowerCase(),
    args: parts.slice(2)
  };
}