/** Client-only: turns a server action's base64/utf8 export payload into a saved file. */
export function downloadFile(filename: string, content: string, mime: string, encoding?: "utf8" | "base64") {
  const bytes =
    encoding === "base64"
      ? Uint8Array.from(atob(content), (char) => char.charCodeAt(0))
      : new TextEncoder().encode(content);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
