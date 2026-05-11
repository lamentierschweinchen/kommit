const SAFE_EXTERNAL_PROTOCOLS = new Set(["https:"]);

export function sanitizeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    if (!SAFE_EXTERNAL_PROTOCOLS.has(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isSafeExternalUrl(raw: string): boolean {
  return sanitizeExternalUrl(raw) !== null;
}
