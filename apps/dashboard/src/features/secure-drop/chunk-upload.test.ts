import { test } from "node:test";
import assert from "node:assert/strict";
import { sendChunk } from "./chunk-upload";

test("chunk uploads time out on inactivity or slow responses, but not while making progress", async t => {
  class FakeXHR {
    static latest: FakeXHR;
    upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number }) => void; onload?: () => void } = {};
    onload?: () => void;
    onerror?: () => void;
    onabort?: () => void;
    status = 204;
    responseText = "";
    aborted = false;
    constructor() { FakeXHR.latest = this; }
    open() {}
    setRequestHeader() {}
    send() {}
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
  } finally {
    t.mock.timers.reset();
    if (original === undefined) Reflect.deleteProperty(globalThis, "XMLHttpRequest");
    else globalThis.XMLHttpRequest = original;
  }
});
