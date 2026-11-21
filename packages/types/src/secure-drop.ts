export const MIN_FILE_BYTES = 1;
export const CHUNK_BYTES = 4 * 1024 ** 2;
export const MAX_SHARE_FILE_BYTES = 5 * 1024 ** 3;
export const MAX_SHARE_BYTES = 20 * 1024 ** 3;
export const MAX_SHARE_FILES = 200;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? "byte" : "bytes"}`;
  if (bytes < 1024 ** 2) return `${Number((bytes / 1024).toFixed(2))} KiB`;
  if (bytes < 1024 ** 3) return `${Number((bytes / 1024 ** 2).toFixed(2))} MiB`;
  return `${Number((bytes / 1024 ** 3).toFixed(2))} GiB`;
}
