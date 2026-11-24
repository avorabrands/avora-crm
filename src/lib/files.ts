/** Browser can render these inline (shared by server and client components). */
export function canPreview(mime: string | null) {
  return !!mime && (mime.startsWith("image/") || mime === "application/pdf" || mime.startsWith("text/"));
}
