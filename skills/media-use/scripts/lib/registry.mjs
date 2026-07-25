// Provider registry — the v2 contract.
//
// Each media type maps to an ORDERED list of provider entries. Providers are
// tried in order; the first to return a non-null result wins, which keeps
// resolution deterministic (same request -> same provider -> same file ->
// reproducible renders).
//
// An entry exposes any of three capability methods — search / generate /
// process — plus { name }. Provider credentials stay in the user's environment.

import { bgmProvider } from "./bgm-provider.mjs";
import { sfxProvider } from "./sfx-provider.mjs";
import { bundledSfxProvider } from "./bundled-sfx-provider.mjs";
import { elevenLabsSfxGenerate } from "./elevenlabs-sfx-provider.mjs";
import { imageProvider, iconProvider } from "./image-provider.mjs";
import { brandProvider } from "./brand-provider.mjs";
import {
  svglSearch,
  simpleIconsSearch,
  githubAvatarSearch,
  faviconSearch,
} from "./logo-provider.mjs";
import { heygenTtsGenerate } from "./voice-provider.mjs";
import { elevenLabsTtsGenerate } from "./elevenlabs-voice-provider.mjs";
import { pexelsVideoProvider } from "./pexels-video-provider.mjs";
import { heygenVideoGenerate } from "./heygen-video-provider.mjs";
import { ltxVideoGenerate } from "./ltx-video-provider.mjs";
import { localTtsGenerate } from "./tts-local-provider.mjs";
import { codexImageGenerate } from "./codex-provider.mjs";
import { mfluxImageGenerate } from "./mflux-provider.mjs";

// Provider markers: `network` = hits a remote service (skipped by --local-only).
// `paid` = may consume metered credits. Agent-initiated paid calls should be
// confirmed by the calling workflow; an explicit user request can run directly.
const A = (name, caps) => ({ name, ...caps }); // local, free
const N = (name, caps) => ({ name, network: true, ...caps }); // remote, free
const P = (name, caps) => ({ name, network: true, paid: true, ...caps }); // remote, paid

const REGISTRY = {
  bgm: [N("heygen.audio.sounds", { search: bgmProvider.search })],
  sfx: [
    // Prefer retrieval and bundled deterministic files. Generate with
    // ElevenLabs only when both search rungs miss.
    N("heygen.audio.sounds", { search: sfxProvider.search }),
    A("bundled.sfx", { search: bundledSfxProvider.search }),
    P("elevenlabs.sfx", { generate: elevenLabsSfxGenerate }),
  ],
  image: [
    N("heygen.asset.search", { search: imageProvider.search }),
    // Catalog miss -> generate. Local first, then the Codex image upsell.
    A("mflux.local", { generate: mfluxImageGenerate }),
    N("codex.image_gen", { generate: codexImageGenerate }),
  ],
  icon: [N("heygen.asset.search", { search: iconProvider.search })],
  logo: [
    // Official brand marks. HeyGen asset search is deliberately absent because
    // generic look-alikes are unsafe for brand identity.
    N("svgl", { search: svglSearch }),
    N("simple-icons", { search: simpleIconsSearch }),
    N("github.avatar", { search: githubAvatarSearch }),
    N("favicon.ddg", { search: faviconSearch }),
  ],
  voice: [
    // HeyGen first for its native word timestamps, ElevenLabs for broad cloud
    // voice coverage, Kokoro as the local/offline fallback.
    P("heygen.tts", { generate: heygenTtsGenerate }),
    P("elevenlabs.tts", { generate: elevenLabsTtsGenerate }),
    A("kokoro.local", { generate: localTtsGenerate }),
  ],
  video: [
    // Stock footage before generation: Pexels is free and records contributor
    // provenance; generation remains HeyGen then local LTX.
    N("pexels.video.search", { search: pexelsVideoProvider.search }),
    P("heygen.video", { generate: heygenVideoGenerate }),
    A("ltx.local", { generate: ltxVideoGenerate }),
  ],
  brand: [
    // Local design spec, not a network provider — reads frame.md/design.md.
    A("design_spec", { search: brandProvider.search }),
  ],
  grade: [
    // Local deterministic cascade handled by resolve.mjs so grade records can
    // carry an inline block as well as an optional frozen .cube file.
    A("color_grade.local", { search: async () => null, generate: async () => null }),
  ],
  lut: [
    // Lower-level local LUT generation/freezing path handled by resolve.mjs.
    A("cube_lut.local", { search: async () => null, generate: async () => null }),
  ],
};

function listFor(type) {
  const list = REGISTRY[type];
  if (!list) throw new Error(`unknown media type: ${type}`);
  return list;
}

/** Ordered providers for a type. */
export function getProviders(type) {
  return listFor(type);
}

/** All declared media types. */
export function listTypes() {
  return Object.keys(REGISTRY);
}

/** Provider names available for a type, in cascade order. */
export function providerNamesFor(type) {
  return listFor(type).map((p) => p.name);
}

/**
 * Does an override token (full name or prefix) match a provider for this type?
 * The rule mirrors runProviders so validation and dispatch never disagree.
 */
export function providerMatches(type, want) {
  return providerNamesFor(type).some((n) => n === want || n.startsWith(`${want}.`));
}

/** Back-compat shim for the v1 single-provider API. */
export function getProvider(type) {
  const first = listFor(type)[0] || {};
  return { ...first, type };
}

/**
 * Run a capability across an explicit ordered provider list. The first non-null
 * result wins. --local-only is a hard guard and always skips network providers,
 * including a network provider selected with --provider.
 */
export async function runProviders(providers, capability, intent, ctx) {
  const want = ctx?.provider;
  for (const p of providers) {
    if (want && p.name !== want && !p.name.startsWith(`${want}.`)) continue;
    if (p.network && ctx?.localOnly) continue;
    const fn = p[capability];
    if (typeof fn !== "function") continue;
    const res = await fn(intent, ctx);
    if (res) return res;
  }
  return null;
}

/** Run a capability over the registered providers for a type. */
export async function runCapability(type, capability, intent, ctx) {
  return runProviders(getProviders(type), capability, intent, ctx);
}
