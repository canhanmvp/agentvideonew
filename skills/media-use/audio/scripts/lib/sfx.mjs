// sfx.mjs — sound effects for the shared audio engine.
//
// Per distinct cue name the cascade is:
//   1. HeyGen catalog retrieval when authenticated
//   2. bundled deterministic SFX library
//   3. ElevenLabs text-to-sound generation when ELEVENLABS_API_KEY is present
//
// A missing effect never blocks a render. Resolved names are cached within the
// run so the same asset can be reused by multiple scene/line ids.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { downloadTo, searchSounds } from "./heygen.mjs";
import { ffprobeDuration } from "./tts.mjs";
import { elevenLabsSfxAvailable, generateElevenLabsSfx } from "./elevenlabs-sfx.mjs";

const SFX_VOLUME = 0.35;
const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "x";
const r3 = (x) => Number(x.toFixed(3));

function loadBundledLookup(sfxLibDir) {
  const manifestPath = join(sfxLibDir, "manifest.json");
  if (!existsSync(manifestPath))
    return { byKey: null, error: `manifest missing at ${manifestPath}` };

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return { byKey: null, error: `manifest parse failed: ${error.message}` };
  }

  const byKey = new Map();
  for (const [key, entry] of Object.entries(manifest || {})) {
    if (!entry?.file || !isFinite(entry.duration)) continue;
    const rec = { key, file: entry.file, duration: entry.duration };
    byKey.set(key, rec);
    byKey.set(entry.file, rec);
    byKey.set(slug(key), rec);
    byKey.set(slug(entry.file.replace(/\.\w+$/, "")), rec);
  }
  return { byKey, error: null };
}

async function retrieveFromHeyGen({ name, headers, hyperframesDir }) {
  const results = await searchSounds(name, "sound_effects", headers, {
    limit: 3,
    minScore: 0.4,
  });
  if (!results.length) return null;
  const top = results[0];
  const file = `assets/sfx/${slug(name)}.mp3`;
  await downloadTo(top.audio_url, join(hyperframesDir, file));
  return {
    name,
    file,
    source: "heygen",
    offset_s: 0,
    duration_s: typeof top.duration === "number" ? r3(top.duration) : 1.0,
    volume: SFX_VOLUME,
  };
}

function resolveFromBundle({ name, lookup, sfxLibDir, hyperframesDir }) {
  if (!lookup) return { record: null, error: "bundled library unavailable" };
  const hit = lookup.get(name) ?? lookup.get(slug(name));
  if (!hit) return { record: null, error: "not in bundled library" };

  const src = join(sfxLibDir, hit.file);
  if (!existsSync(src)) {
    return {
      record: null,
      error:
        `bundled file ${hit.file} missing from ${sfxLibDir}; reinstall the media-use skill ` +
        "or configure a cloud SFX provider",
    };
  }
  const file = `assets/sfx/${hit.file}`;
  const dest = join(hyperframesDir, file);
  mkdirSync(join(hyperframesDir, "assets", "sfx"), { recursive: true });
  if (!existsSync(dest)) copyFileSync(src, dest);
  return {
    record: {
      name,
      file,
      source: "local",
      offset_s: 0,
      duration_s: r3(hit.duration),
      volume: SFX_VOLUME,
    },
    error: null,
  };
}

async function generateFromElevenLabs({ name, hyperframesDir, generate, probe }) {
  const generated = await generate({ text: name });
  const file = `assets/sfx/${slug(name)}.mp3`;
  const dest = join(hyperframesDir, file);
  mkdirSync(join(hyperframesDir, "assets", "sfx"), { recursive: true });
  writeFileSync(dest, generated.bytes);
  const measured = probe(dest);
  const duration =
    Number.isFinite(measured) && measured > 0
      ? measured
      : Number.isFinite(generated.requestedDuration)
        ? generated.requestedDuration
        : 1.0;
  return {
    name,
    file,
    source: "elevenlabs",
    offset_s: 0,
    duration_s: r3(duration),
    volume: SFX_VOLUME,
  };
}

// cues: [{ id, name, offset_s?, role? }] (id = the line/frame/scene the cue fires in). Returns
// { sfx: [{ id, name, file, source, offset_s, role?, duration_s, volume }], anomalies }.
export async function resolveSfx(
  { cues, heygenOK, headers, hyperframesDir, sfxLibDir },
  deps = {},
) {
  const sfx = [];
  const anomalies = [];
  const seen = new Set();
  const uniq = (cues || []).filter((cue) => {
    const key = `${cue.id}:${cue.name}:${cue.offset_s ?? 0}:${cue.role ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const { byKey, error: bundleError } = loadBundledLookup(sfxLibDir);
  const generatedAvailable = deps.elevenlabsOK ?? elevenLabsSfxAvailable();
  const generate = deps.generateElevenLabsSfx || generateElevenLabsSfx;
  const probe = deps.ffprobeDuration || ffprobeDuration;
  const byName = new Map();

  for (const { id, name, offset_s = 0, role } of uniq) {
    const cacheKey = slug(name);
    const cached = byName.get(cacheKey);
    if (cached) {
      sfx.push({ ...cached, id, name, offset_s, ...(role ? { role } : {}) });
      continue;
    }

    let record = null;
    const failures = [];

    if (heygenOK) {
      try {
        record = await retrieveFromHeyGen({ name, headers, hyperframesDir });
        if (!record) failures.push("no HeyGen match");
      } catch (error) {
        failures.push(`HeyGen retrieval failed: ${error.message}`);
      }
    }

    if (!record) {
      const local = resolveFromBundle({
        name,
        lookup: byKey,
        sfxLibDir,
        hyperframesDir,
      });
      record = local.record;
      if (!record && local.error) failures.push(local.error);
    }

    if (!record && generatedAvailable) {
      try {
        record = await generateFromElevenLabs({ name, hyperframesDir, generate, probe });
      } catch (error) {
        failures.push(`ElevenLabs generation failed: ${error.message}`);
      }
    }

    if (!record) {
      const details = [...new Set([bundleError, ...failures].filter(Boolean))].join("; ");
      anomalies.push(`sfx "${name}" (id ${id}): unresolved${details ? ` — ${details}` : ""}`);
      continue;
    }

    byName.set(cacheKey, record);
    sfx.push({ ...record, id, name, offset_s, ...(role ? { role } : {}) });
  }

  return { sfx, anomalies };
}
