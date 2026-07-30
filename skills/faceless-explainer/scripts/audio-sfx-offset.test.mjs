import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const audioScript = fileURLToPath(new URL("./audio.mjs", import.meta.url));
const assembleScript = fileURLToPath(new URL("./assemble-index.mjs", import.meta.url));

function frameHtml(id) {
  return `<!doctype html>
<html><body><div id="root" data-composition-id="${id}" data-width="1080" data-height="1920"></div></body></html>`;
}

test("storyboard SFX offset survives request, audio_meta, and assembled HTML", () => {
  const dir = mkdtempSync(join(tmpdir(), "hf-sfx-offset-"));
  try {
    mkdirSync(join(dir, "compositions", "frames"), { recursive: true });
    mkdirSync(join(dir, "assets", "sfx"), { recursive: true });
    writeFileSync(join(dir, "assets", "sfx", "whoosh.mp3"), "ID3-fake");
    writeFileSync(join(dir, "compositions", "frames", "01-context.html"), frameHtml("01-context"));
    writeFileSync(join(dir, "compositions", "frames", "02-reveal.html"), frameHtml("02-reveal"));
    writeFileSync(
      join(dir, "STORYBOARD.md"),
      `---
format: 1080x1920
message: Test
---

## Frame 1 — Context
- status: animated
- src: compositions/frames/01-context.html
- duration: 2s

Context.

## Frame 2 — Reveal
- status: animated
- src: compositions/frames/02-reveal.html
- duration: 3s
- sfx: whoosh@0.35

Reveal.
`,
    );

    const engine = join(dir, "engine.mjs");
    writeFileSync(
      engine,
      `import { readFileSync, writeFileSync } from "node:fs";
const argv = process.argv.slice(2);
const flag = (name) => argv[argv.indexOf(name) + 1];
const request = JSON.parse(readFileSync(flag("--request"), "utf8"));
writeFileSync(new URL("request.json", import.meta.url), JSON.stringify(request));
const sfx = request.lines.flatMap((line) => line.sfx.map((cue) => ({
  id: line.id,
  name: typeof cue === "string" ? cue : cue.name,
  file: "assets/sfx/whoosh.mp3",
  source: "local",
  offset_s: typeof cue === "string" ? 0 : cue.offset_s,
  duration_s: 0.8,
  volume: 0.35
})));
writeFileSync(flag("--out"), JSON.stringify({ voices: [], bgm: null, sfx }));
`,
    );

    const audio = spawnSync(
      process.execPath,
      [audioScript, "fetch-sfx", "--hyperframes", dir, "--storyboard", join(dir, "STORYBOARD.md")],
      { encoding: "utf8", env: { ...process.env, HF_MEDIA_ENGINE: engine } },
    );
    assert.equal(audio.status, 0, audio.stderr);

    const request = JSON.parse(readFileSync(join(dir, "request.json"), "utf8"));
    assert.deepEqual(request.lines[0].sfx[0], { name: "whoosh", offset_s: 0.35 });
    const meta = JSON.parse(readFileSync(join(dir, "audio_meta.json"), "utf8"));
    assert.equal(meta.sfx[0].frame, 2);
    assert.equal(meta.sfx[0].offset_s, 0.35);

    const assembled = spawnSync(
      process.execPath,
      [assembleScript, "--hyperframes", dir, "--storyboard", join(dir, "STORYBOARD.md")],
      { encoding: "utf8" },
    );
    assert.equal(assembled.status, 0, assembled.stderr);
    const html = readFileSync(join(dir, "index.html"), "utf8");
    assert.match(html, /<audio[\s\S]*?src="assets\/sfx\/whoosh\.mp3"[\s\S]*?data-start="2\.35"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
