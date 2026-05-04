/**
 * Convert a dropbox share url to a direct download link.
 * @param {string} url - The Dropbox share URL.
 * @returns {string} - The direct download URL.
 */
export function dropboxShareUrlToDirectDownload(url: string): string {
  if (!url) return "";
  const newUrl = url
    .replace("dropbox.com", "dl.dropboxusercontent.com")
    .replace("?dl=0", "?raw=1");

  return newUrl;
}
