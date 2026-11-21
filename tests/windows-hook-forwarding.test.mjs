import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { test } from "node:test";

const launcher = new URL(
  "../node_modules/@pruven/zeke/dist/lib/hook.js",
  import.meta.url,
);
const windows = { skip: process.platform !== "win32" };

function fixture(t, hook, body) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saasflow-hook-test-"));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const previous = path.join(root, "previous hooks & $literal");
  const runtime = path.join(root, "runtime");
  const cwd = path.join(root, "nested directory");
  for (const dir of [previous, path.join(runtime, "lib"), cwd])
    fs.mkdirSync(dir, { recursive: true });
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
  fs.writeFileSync(path.join(previous, hook), body);
  return { root, cwd, command: [path.join(runtime, "lib", "hook.js"), hook] };
}

for (const [name, input, status] of [
  [
    "pre-push refs and rejection status",
    Buffer.from("refs/heads/main abc refs/heads/main def\n"),
    7,
  ],
  ["empty stdin", Buffer.alloc(0), 0],
  ["binary stdin", Buffer.from([0, 1, 13, 10, 127, 255]), 0],
]) {
  test(`Windows hook forwards ${name}`, windows, (t) => {
    const f = fixture(
      t,
      "pre-push",
      '#!/bin/sh\ncat > "$CAPTURE"\nprintf "args:<%s><%s>\\n" "$1" "$2"\nprintf "hook stderr\\n" >&2\nexit "$HOOK_STATUS"\n',
    );
    const capture = path.join(f.root, "stdin.bin");
    const argument = 'origin with spaces; $(echo injected) "quoted"';
    const result = spawnSync(
      process.execPath,
      [...f.command, argument, "https://example.test/repo"],
      {
        cwd: f.cwd,
        input,
        encoding: "utf8",
        timeout: 10_000,
        env: { ...process.env, CAPTURE: capture, HOOK_STATUS: String(status) },
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, status, result.stderr);
    assert.deepEqual(fs.readFileSync(capture), input);
    assert.equal(
      result.stdout,
      `args:<${argument}><https://example.test/repo>\n`,
    );
    assert.equal(result.stderr, "hook stderr\n");
  });
}

test(
  "Windows forwarding honors a non-shell shebang and preserves cwd",
  windows,
  (t) => {
    const f = fixture(
      t,
      "pre-push",
      "#!/usr/bin/env node\nconsole.log(JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }));\n",
    );
    const result = spawnSync(process.execPath, [...f.command, "two words"], {
      cwd: f.cwd,
      input: "",
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      cwd: f.cwd,
      args: ["two words"],
    });
  },
);

test(
  "proc-receive replies on stdout before stdin reaches EOF",
  { ...windows, timeout: 15_000 },
  async (t) => {
    const f = fixture(
      t,
      "proc-receive",
      '#!/bin/sh\nIFS= read -r version\n[ "$version" = "000eversion=1" ] || exit 8\nprintf "000eversion=1\\n0000"\nIFS= read -r flush\n[ "$flush" = "0000" ] || exit 9\nprintf "protocol complete\\n" >&2\n',
    );
    const child = spawn(process.execPath, f.command, {
      cwd: f.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    const exited = new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    let timer;
    const handshake = "000eversion=1\n0000";
    const negotiated = new Promise((resolve, reject) => {
      timer = setTimeout(
        () =>
          reject(new Error("No protocol response while stdin remained open")),
        8_000,
      );
      child.stdout.on("data", (data) => {
        stdout += data;
        if (stdout.length >= handshake.length) resolve();
      });
      child.once("error", reject);
      child.once("exit", () =>
        reject(new Error(`Exited before negotiation: ${stderr}`)),
      );
    });
    try {
      child.stdin.write(handshake);
      await negotiated;
      assert.equal(child.stdin.writableEnded, false);
      assert.equal(stdout, handshake);
      child.stdin.end("\n");
      assert.equal(await exited, 0, stderr);
      assert.equal(stdout, handshake);
      assert.equal(stderr, "protocol complete\n");
    } finally {
      clearTimeout(timer);
      child.stdin.destroy();
      child.kill();
      await exited;
    }
  },
);
