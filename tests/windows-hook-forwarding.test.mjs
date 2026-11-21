import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const launcher = new URL(
  "../node_modules/@pruven/zeke/dist/lib/hook.js",
  import.meta.url,
);

for (const [name, input, status] of [
  [
    "pre-push refs and rejection status",
    Buffer.from("refs/heads/main abc refs/heads/main def\n"),
    7,
  ],
  ["empty stdin", Buffer.alloc(0), 0],
  ["binary stdin", Buffer.from([0, 1, 13, 10, 127, 255]), 0],
]) {
  test(
    `Windows hook forwards ${name}`,
    { skip: process.platform !== "win32" },
    (t) => {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "saasflow-hook-test-"),
      );
      t.after(() => {
        assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
        fs.rmSync(root, { recursive: true, force: true });
      });
      const previous = path.join(root, "previous hooks");
      const runtime = path.join(root, "runtime");
      const temporary = path.join(root, "temporary");
      for (const directory of [
        previous,
        path.join(runtime, "lib"),
        temporary,
      ]) {
        fs.mkdirSync(directory, { recursive: true });
      }
      assert.equal(spawnSync("git", ["init", "--quiet", root]).status, 0);
      fs.writeFileSync(path.join(runtime, "package.json"), '{"type":"module"}');
      fs.copyFileSync(launcher, path.join(runtime, "lib", "hook.js"));
      fs.writeFileSync(
        path.join(runtime, "lib", "zeke.js"),
        'export function sync() { throw new Error("unexpected sync"); }',
      );
      fs.writeFileSync(
        path.join(runtime, "state.json"),
        JSON.stringify({ previousEffective: previous }),
      );
      fs.writeFileSync(
        path.join(previous, "pre-push"),
        '#!/bin/sh\ncat > "$CAPTURE"\nprintf "args:<%s><%s>\\n" "$1" "$2"\nprintf "hook stderr\\n" >&2\nexit "$HOOK_STATUS"\n',
      );
      const capture = path.join(root, "stdin.bin");
      const result = spawnSync(
        process.execPath,
        [
          path.join(runtime, "lib", "hook.js"),
          "pre-push",
          "origin with spaces",
          "https://example.test/repo",
        ],
        {
          cwd: root,
          input,
          encoding: "utf8",
          timeout: 10_000,
          env: {
            ...process.env,
            TEMP: temporary,
            TMP: temporary,
            CAPTURE: capture,
            HOOK_STATUS: String(status),
          },
        },
      );
      assert.ifError(result.error);
      assert.equal(result.status, status, result.stderr);
      assert.deepEqual(fs.readFileSync(capture), input);
      // git hook run routes hook stdout to stderr; preserve that existing behavior.
      assert.match(
        result.stderr,
        /args:<origin with spaces><https:\/\/example.test\/repo>/,
      );
      assert.match(result.stderr, /hook stderr/);
      assert.deepEqual(
        fs.readdirSync(temporary),
        [],
        "stdin staging files must be removed",
      );
    },
  );
}
