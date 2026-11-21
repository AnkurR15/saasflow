import assert from "node:assert/strict";
import { createHash, randomFillSync } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { CHUNK_BYTES, MAX_SHARE_BYTES, MAX_SHARE_FILE_BYTES, MAX_SHARE_FILES } from "@repo/types";

// Exercise the same HTTP protocol as the browser. Keep one chunk in memory,
// including when hashing the response to a 5 GiB download.
export async function verifyTransferBoundaries(shares: string, origin: string, cookie: string, large: boolean) {
  const headers = { origin, cookie };
  const downloadUrl = new URL("/api/secure-drop/file", shares);
  // Exercise a maximum-count manifest with multibyte folder names as well.
  const manifest = (sizes: number[]) => {
    const folder = sizes.length === MAX_SHARE_FILES ? Array(4).fill("文".repeat(140)).join("/") : "folder";
    return sizes.map((size, i) => ({ path: `${folder}/file-${i}.bin`, size }));
  };
  const create = (sizes: number[]) => fetch(shares, {
    method: "POST", headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ files: manifest(sizes), hours: 1, downloadOnce: true }),
  });
  const fullShare = Array<number>(MAX_SHARE_BYTES / MAX_SHARE_FILE_BYTES).fill(MAX_SHARE_FILE_BYTES);
  for (const sizes of [[], [0], [-1], [1.5], [MAX_SHARE_FILE_BYTES + 1], [...fullShare, 1], Array<number>(MAX_SHARE_FILES + 1).fill(1)]) {
    const response = await create(sizes);
    assert.equal(response.status, 400, `invalid manifest with ${sizes.length} file(s)`);
    await response.body?.cancel();
  }

  for (const sizes of [[1], Array<number>(MAX_SHARE_FILES).fill(1), ...(large ? [fullShare] : [])]) {
    const response = await create(sizes);
    assert.equal(response.status, 201);
    const draft: { id: string; files: { id: string; path: string }[] } = await response.json();
    const ids = new Map(draft.files.map(file => [file.path, file.id]));
    const files = manifest(sizes);
    const expected = new Map<string, string>();
    for (const [fileNumber, file] of files.entries()) {
      const id = ids.get(file.path);
      assert.ok(id);
      const hash = createHash("sha256");
      const chunk = randomFillSync(new Uint8Array(Math.min(file.size, CHUNK_BYTES)));
      for (let offset = 0, index = 0; offset < file.size; offset += CHUNK_BYTES, index++) {
        if (chunk.length >= 4) new DataView(chunk.buffer).setUint32(0, index);
        const body = chunk.subarray(0, Math.min(chunk.length, file.size - offset));
        hash.update(body);
        const send = (): Promise<Response> => fetch(`${shares}/${draft.id}/files/${id}`, {
          method: "PUT", headers: { ...headers, "content-type": "application/octet-stream", "x-chunk-index": String(index) }, body,
        });
        let uploaded = await send();
        if (uploaded.status === 429) {
          await uploaded.body?.cancel();
          await delay(Number(uploaded.headers.get("retry-after")) * 1000 + 50);
          uploaded = await send();
        }
        assert.equal(uploaded.status, 204, `file ${fileNumber + 1}, chunk ${index}`);
      }
      expected.set(id, hash.digest("hex"));
      if (file.size === MAX_SHARE_FILE_BYTES) console.info(`Uploaded maximum-size file ${fileNumber + 1}/${files.length}`);
    }
    const published = await fetch(`${shares}/${draft.id}`, { method: "POST", headers });
    assert.equal(published.status, 200);
    const { token } = await published.json();
    for (const file of files) {
      const id = ids.get(file.path)!;
      const download = await fetch(downloadUrl, { method: "POST", headers: { origin }, body: new URLSearchParams({ token, fileId: id }) });
      assert.equal(download.status, 200);
      const length = download.headers.get("content-length");
      if (length !== null) assert.equal(length, String(file.size));
      const reader = download.body!.getReader();
      const hash = createHash("sha256");
      let bytes = 0;
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        hash.update(part.value);
        bytes += part.value.byteLength;
      }
      assert.equal(bytes, file.size);
      assert.equal(hash.digest("hex"), expected.get(id));
      if (file.size === MAX_SHARE_FILE_BYTES) console.info(`Verified ${bytes} downloaded bytes for ${file.path}`);
    }
  }
}
