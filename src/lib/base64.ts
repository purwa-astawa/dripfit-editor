// Base64 transport for the exported dripfit-config. Shopify refuses to save a
// theme setting value containing Liquid delimiters (`{{`/`}}`/`{%`/`%}`), and a
// real config always ends in nested braces, so the editor's default export is
// base64 (brace-free). These helpers keep the encode (ExportModal) and decode
// (ConfigureModal import) in one place so they can't drift.

/** UTF-8-safe base64 encode — `btoa` alone mangles non-Latin1 bytes. Chunked to
 *  avoid call-stack limits on large configs (e.g. a baked data-URI poster). */
export function toBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Inverse of toBase64Utf8. Throws if the input isn't valid base64. */
export function fromBase64Utf8(b64: string): string {
  const binary = atob(b64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Parse a pasted/loaded dripfit-config that may be raw JSON *or* the theme-safe
 *  base64 export. Tries JSON first, then base64-decode → JSON. */
export function parseConfigText(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Not raw JSON — fall back to the base64 export format.
    try {
      return JSON.parse(fromBase64Utf8(trimmed));
    } catch {
      throw new Error(
        'Not a valid dripfit-config: expected JSON or a base64-encoded config.',
      );
    }
  }
}
