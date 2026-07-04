// Normalize common "share page" image URLs into direct raw-image URLs that an
// <img>/canvas can actually load. Share links (Dropbox preview pages, Google
// Drive file viewers) serve HTML, not image bytes, so they fail to load as-is.
//
//   - Dropbox   www.dropbox.com/.../file.png?dl=0   -> dl.dropboxusercontent.com/.../file.png
//   - Drive     drive.google.com/file/d/{id}/view   -> drive.google.com/thumbnail?id={id}&sz=w2048
//
// (Drive's `uc?export=view` endpoint returns bytes to curl but is rejected by
// browser <img> loads; the `thumbnail` endpoint hotlinks reliably.)
//
// Returns the input unchanged if it's not a recognized share link.

// Max dimension requested from Drive's thumbnail endpoint (it caps ~2048px).
const DRIVE_THUMB_SIZE = 'w2048';

export function normalizeImageUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return raw;

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    // Not a parseable absolute URL — hand it back untouched.
    return raw;
  }

  const host = u.hostname.toLowerCase();

  // Dropbox share link -> raw-file host. Drop the `dl` param (dl=0 serves an
  // HTML preview page; the raw host serves the file directly).
  if (host === 'www.dropbox.com' || host === 'dropbox.com') {
    u.hostname = 'dl.dropboxusercontent.com';
    u.searchParams.delete('dl');
    return u.toString();
  }

  // Google Drive file viewer -> hotlink-friendly thumbnail endpoint.
  if (host === 'drive.google.com') {
    const id = extractDriveId(u);
    if (id)
      return `https://drive.google.com/thumbnail?id=${id}&sz=${DRIVE_THUMB_SIZE}`;
  }

  return raw;
}

function extractDriveId(u: URL): string | null {
  // /file/d/{id}/view  (and /file/d/{id})
  const pathMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
  if (pathMatch) return pathMatch[1];
  // /open?id={id}, /uc?id={id}, /uc?export=view&id={id}
  const idParam = u.searchParams.get('id');
  if (idParam) return idParam;
  return null;
}
