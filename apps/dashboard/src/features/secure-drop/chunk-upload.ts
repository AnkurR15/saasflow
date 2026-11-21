const UPLOAD_IDLE_MS = 5 * 60_000;
const RESPONSE_TIMEOUT_MS = 2 * 60_000;

export function sendChunk(url: string, blob: Blob, index: number, progress: (bytes: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let timer: ReturnType<typeof setTimeout>;
    let settled = false;
    let uploaded = 0;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    const deadline = (milliseconds: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        finish(Object.assign(new Error("Upload timed out. Please try again."), { retryable: true }));
        xhr.abort();
      }, milliseconds);
    };
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("x-chunk-index", String(index));
    xhr.upload.onprogress = event => {
      if (event.loaded > uploaded) { uploaded = event.loaded; deadline(UPLOAD_IDLE_MS); }
      if (event.lengthComputable) progress(event.loaded);
    };
    xhr.upload.onload = () => deadline(RESPONSE_TIMEOUT_MS);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return finish();
      let message = "Upload failed.";
      try { message = JSON.parse(xhr.responseText).error || message; } catch { /* A proxy may return HTML. */ }
      const seconds = Number(xhr.getResponseHeader("Retry-After"));
      finish(Object.assign(new Error(message), {
        retryable: xhr.status === 429 || xhr.status >= 500,
        retryAfterMs: Number.isFinite(seconds) ? Math.min(60, Math.max(0, seconds)) * 1000 : 0,
      }));
    };
    xhr.onerror = () => finish(Object.assign(new Error("Upload interrupted. Please try again."), { retryable: true }));
    xhr.onabort = () => finish(Object.assign(new Error("Upload interrupted. Please try again."), { retryable: true }));
    deadline(UPLOAD_IDLE_MS);
    try { xhr.send(blob); } catch (error) { finish(error instanceof Error ? error : new Error("Upload failed.")); }
  });
}

export async function uploadChunk(url: string, blob: Blob, index: number, progress: (bytes: number) => void) {
  for (let attempt = 0; ; attempt++) {
    try {
      await sendChunk(url, blob, index, progress);
      return;
    } catch (error) {
      if (attempt >= 2 || !(error instanceof Error && "retryable" in error && error.retryable)) throw error;
      const backoff = 1000 * (attempt + 1);
      const retryAfter = "retryAfterMs" in error && typeof error.retryAfterMs === "number" ? error.retryAfterMs : 0;
      await new Promise(resolve => setTimeout(resolve, Math.max(backoff, retryAfter)));
    }
  }
}
