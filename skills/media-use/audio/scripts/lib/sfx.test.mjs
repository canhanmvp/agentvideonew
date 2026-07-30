import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveSfx } from "./sfx.mjs";

async function withDirs(fn) {
  const root = mkdtempSync(join(tmpdir(), "hf-sfx-"));
  const libDir = join(root, "lib");
  const projDir = join(root, "proj");
  mkdirSync(libDir, { recursive: true });
  mkdirSync(projDir, { recursive: true });
  try {
    return await fn({ libDir, projDir });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("offline: copies and references a present bundled file", async () => {
  await withDirs(async ({ libDir, projDir }) => {
    writeFileSync(
      join(libDir, "manifest.json"),
      JSON.stringify({ whoosh: { file: "whoosh.mp3", duration: 0.8 } }),
    );
    writeFileSync(join(libDir, "whoosh.mp3"), "ID3-fake-bytes");
    const { sfx, anomalies } = await resolveSfx(
      {
        cues: [{ id: "s1", name: "whoosh" }],
        heygenOK: false,
        hyperframesDir: projDir,
        sfxLibDir: libDir,
      },
      { elevenlabsOK: false },
    );
    assert.equal(sfx.length, 1);
    assert.equal(sfx[0].file, "assets/sfx/whoosh.mp3");
    assert.equal(sfx[0].source, "local");
    assert.ok(existsSync(join(projDir, "assets/sfx/whoosh.mp3")), "mp3 copied into project");
    assert.equal(anomalies.length, 0);
  });
});

test("offline: a matched-but-missing bundled file yields an anomaly and no dangling entry", async () => {
  await withDirs(async ({ libDir, projDir }) => {
    writeFileSync(
      join(libDir, "manifest.json"),
      JSON.stringify({ whoosh: { file: "whoosh.mp3", duration: 0.8 } }),
    );
    const { sfx, anomalies } = await resolveSfx(
      {
        cues: [{ id: "s1", name: "whoosh" }],
        heygenOK: false,
        hyperframesDir: projDir,
        sfxLibDir: libDir,
      },
      { elevenlabsOK: false },
    );
    assert.equal(sfx.length, 0, "no dangling entry for a file that was never copied");
    assert.equal(anomalies.length, 1);
    assert.match(anomalies[0], /bundled file whoosh\.mp3 missing/);
    assert.ok(!existsSync(join(projDir, "assets/sfx/whoosh.mp3")), "nothing copied");
  });
});

test("ElevenLabs generates a long-tail cue after retrieval and local lookup miss", async () => {
  await withDirs(async ({ libDir, projDir }) => {
    writeFileSync(join(libDir, "manifest.json"), JSON.stringify({}));
    let calls = 0;
    const { sfx, anomalies } = await resolveSfx(
      {
        cues: [{ id: "s1", name: "glassy sci-fi confirmation" }],
        heygenOK: false,
        hyperframesDir: projDir,
        sfxLibDir: libDir,
      },
      {
        elevenlabsOK: true,
        generateElevenLabsSfx: async ({ text }) => {
          calls += 1;
          assert.equal(text, "glassy sci-fi confirmation");
          return { bytes: Buffer.from("ID3-generated"), requestedDuration: 1.2 };
        },
        ffprobeDuration: () => 1.25,
      },
    );
    assert.equal(calls, 1);
    assert.equal(sfx.length, 1);
    assert.equal(sfx[0].source, "elevenlabs");
    assert.equal(sfx[0].duration_s, 1.25);
    assert.ok(existsSync(join(projDir, sfx[0].file)));
    assert.deepEqual(anomalies, []);
  });
});

test("the same generated cue name is reused across multiple ids", async () => {
  await withDirs(async ({ libDir, projDir }) => {
    writeFileSync(join(libDir, "manifest.json"), JSON.stringify({}));
    let calls = 0;
    const { sfx } = await resolveSfx(
      {
        cues: [
          { id: "s1", name: "soft digital shimmer" },
          { id: "s2", name: "soft digital shimmer" },
        ],
        heygenOK: false,
        hyperframesDir: projDir,
        sfxLibDir: libDir,
      },
      {
        elevenlabsOK: true,
        generateElevenLabsSfx: async () => {
          calls += 1;
          return { bytes: Buffer.from("ID3-generated"), requestedDuration: 1 };
        },
        ffprobeDuration: () => 1,
      },
    );
    assert.equal(calls, 1, "generate once per distinct name");
    assert.equal(sfx.length, 2);
    assert.equal(sfx[0].file, sfx[1].file);
    assert.notEqual(sfx[0].id, sfx[1].id);
  });
});

test("preserves independent offset and role metadata while reusing one asset", async () => {
  await withDirs(async ({ libDir, projDir }) => {
    writeFileSync(
      join(libDir, "manifest.json"),
      JSON.stringify({ whoosh: { file: "whoosh.mp3", duration: 0.8 } }),
    );
    writeFileSync(join(libDir, "whoosh.mp3"), "ID3-fake-bytes");
    const { sfx } = await resolveSfx(
      {
        cues: [
          { id: "s1", name: "whoosh", offset_s: 0.35, role: "reveal" },
          { id: "s1", name: "whoosh", offset_s: 1.2, role: "impact" },
        ],
        heygenOK: false,
        hyperframesDir: projDir,
        sfxLibDir: libDir,
      },
      { elevenlabsOK: false },
    );
    assert.equal(sfx.length, 2);
    assert.deepEqual(
      sfx.map(({ offset_s, role }) => ({ offset_s, role })),
      [
        { offset_s: 0.35, role: "reveal" },
        { offset_s: 1.2, role: "impact" },
      ],
    );
    assert.equal(sfx[0].file, sfx[1].file);
  });
});
