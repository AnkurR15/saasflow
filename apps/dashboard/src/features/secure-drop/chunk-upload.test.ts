import { test } from "node:test";
import assert from "node:assert/strict";
import { sendChunk, uploadChunk } from "./chunk-upload";

test("chunk uploads time out on stalls and retry throttled requests with the same chunk", async t => {
  class FakeXHR {
    static latest: FakeXHR;
    upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number }) => void; onload?: () => void } = {};
    onload?: () => void;
    onerror?: () => void;
    onabort?: () => void;
    status = 204;
    responseText = "";
    aborted = false;
    url?: string;
    chunkIndex?: string;
    body?: Blob;
    constructor() { FakeXHR.latest = this; }
    open(_method: string, url: string) { this.url = url; }
    setRequestHeader(name: string, value: string) { if (name === "x-chunk-index") this.chunkIndex = value; }
    getResponseHeader(name: string) { return name === "Retry-After" ? "10" : null; }
    send(body: Blob) { this.body = body; }
    abort() { this.aborted = true; this.onabort?.(); }
  }
  const original = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const progress: number[] = [];
    const active = sendChunk("/upload", new Blob(["file"]), 0, bytes => progress.push(bytes));
    const activeXhr = FakeXHR.latest;
    t.mock.timers.tick(4 * 60_000);
    activeXhr.upload.onprogress?.({ lengthComputable: true, loaded: 1 });
    t.mock.timers.tick(4 * 60_000);
    activeXhr.upload.onprogress?.({ lengthComputable: true, loaded: 2 });
    activeXhr.upload.onload?.();
    t.mock.timers.tick(119_000);
    activeXhr.onload?.();
    await active;
    t.mock.timers.tick(5 * 60_000);
    assert.deepEqual(progress, [1, 2]);
    assert.equal(activeXhr.aborted, false);

    const stalled = sendChunk("/upload", new Blob(["file"]), 0, () => {});
    const stalledXhr = FakeXHR.latest;
    const stalledError = assert.rejects(stalled, (error: unknown) => error instanceof Error && "retryable" in error && error.retryable === true);
    t.mock.timers.tick(4 * 60_000);
    stalledXhr.upload.onprogress?.({ lengthComputable: true, loaded: 0 });
    t.mock.timers.tick(60_000);
    await stalledError;
    assert.equal(stalledXhr.aborted, true);

    const waiting = sendChunk("/upload", new Blob(["file"]), 0, () => {});
    const waitingXhr = FakeXHR.latest;
    const waitingError = assert.rejects(waiting, (error: unknown) => error instanceof Error && "retryable" in error && error.retryable === true);
    waitingXhr.upload.onload?.();
    t.mock.timers.tick(2 * 60_000);
    await waitingError;
    assert.equal(waitingXhr.aborted, true);

    const payload = new Blob(["file"]);
    const throttled = uploadChunk("/upload", payload, 7, () => {});
    const first = FakeXHR.latest;
    first.status = 429;
    first.onload?.();
    await Promise.resolve();
    t.mock.timers.tick(9999);
    await Promise.resolve();
    assert.equal(FakeXHR.latest, first);
    t.mock.timers.tick(1);
    await Promise.resolve();
    const retry = FakeXHR.latest;
    assert.notEqual(retry, first);
    assert.equal(retry.url, first.url);
    assert.equal(retry.chunkIndex, "7");
    assert.equal(retry.body, payload);
    retry.onload?.();
    await throttled;

    const blocked = uploadChunk("/upload", payload, 7, () => {});
    const exhausted = assert.rejects(blocked, /Too many requests/);
    for (let attempt = 0; attempt < 3; attempt++) {
      const xhr = FakeXHR.latest;
      xhr.status = 429;
      xhr.responseText = '{"error":"Too many requests"}';
      xhr.onload?.();
      await Promise.resolve();
      t.mock.timers.tick(10_000);
      await Promise.resolve();
      if (attempt === 2) assert.equal(FakeXHR.latest, xhr);
      else assert.notEqual(FakeXHR.latest, xhr);
    }
    await exhausted;
  } finally {
    t.mock.timers.reset();
    if (original === undefined) Reflect.deleteProperty(globalThis, "XMLHttpRequest");
    else globalThis.XMLHttpRequest = original;
  }
});
