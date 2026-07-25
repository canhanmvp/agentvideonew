// tts.mjs — multi-provider TTS for the media audio engine.
//
// Provider order:
//   1. HeyGen Starfish — native word timestamps
//   2. ElevenLabs REST — cloud fallback, no Python SDK required
//   3. Kokoro local — offline fallback

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { heygenAuthHeaders, heygenCredential, heygenJSON } from "./heygen.mjs";

// ── provider detection ────────────────────────────────────────────────────────
export function heygenAvailable() {
  return heygenCredential() !== null;
}

export function elevenlabsAvailable() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export function pickProvider(userProvider) {
  if (userProvider) {
    if (!["heygen", "elevenlabs", "kokoro"].includes(userProvider))
      throw new Error(`invalid provider "${userProvider}" (heygen | elevenlabs | kokoro)`);
    if (userProvider === "heygen" && !heygenAvailable())
      throw new Error(
        "provider=heygen but no HeyGen credentials (set $HEYGEN_API_KEY or run `npx hyperframes auth login`)",
      );
    if (userProvider === "elevenlabs" && !process.env.ELEVENLABS_API_KEY)
      throw new Error("provider=elevenlabs but $ELEVENLABS_API_KEY is not set");
    return userProvider;
  }
  return heygenAvailable() ? "heygen" : elevenlabsAvailable() ? "elevenlabs" : "kokoro";
}

// ── voice resolution ──────────────────────────────────────────────────────────
export async function resolveVoiceId({ provider, userVoice, lang = "en" }) {
  if (userVoice) return userVoice;
  if (provider === "elevenlabs")
    return process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel
  if (provider === "kokoro") {
    if (lang === "en") return "am_michael";
    throw new Error("Kokoro non-English needs an explicit --voice (see references/tts.md)");
  }
  if (lang === "en") return "05f19352e8f74b0392a8f411eba40de1"; // Marcia
  const payload = await heygenJSON(`/voices?engine=starfish&type=public&limit=50`, {
    headers: heygenAuthHeaders(),
  });
  const voices = payload.data ?? payload.voices ?? [];
  const pick = voices.find((v) => v.language === "English") ?? voices[0];
  if (!pick) throw new Error("no public starfish voice to default to — pass --voice");
  return pick.voice_id;
}

export function chooseElevenLabsModel(lang = "en", configured = process.env.ELEVENLABS_TTS_MODEL) {
  if (configured) return configured;
  return /^vi(?:-|$)/i.test(String(lang)) ? "eleven_flash_v2_5" : "eleven_multilingual_v2";
}

// ── helpers ─────────────────────────────────────────────────────────────────
export function withWordIds(words) {
  return (words ?? []).map((w, i) => ({
    id: `w${i}`,
    text: w.text,
    start: w.start,
    end: w.end,
  }));
}

export function parseFfmpegDurationBanner(stderrText) {
  const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderrText ?? "");
  if (!match) return NaN;
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function ffmpegDurationFallback(absPath) {
  const r = spawnSync("ffmpeg", ["-i", absPath], { encoding: "utf8" });
  return parseFfmpegDurationBanner(r.stderr);
}

export function ffprobeDuration(absPath) {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", absPath],
    { encoding: "utf8" },
  );
  if (r.error?.code === "ENOENT") return ffmpegDurationFallback(absPath);
  if (r.status !== 0) return NaN;
  return parseFloat(String(r.stdout).trim());
}

export function resolveNpxCliFromNpmExecPath(
  npmExecPath = process.env.npm_execpath,
  pathExists = existsSync,
) {
  if (!npmExecPath) return null;
  const fileName = npmExecPath.replace(/\\/g, "/").split("/").pop()?.toLowerCase();
  const npxCliPath =
    fileName === "npx-cli.js" ? npmExecPath : join(dirname(npmExecPath), "npx-cli.js");
  return pathExists(npxCliPath) ? npxCliPath : null;
}

export function resolveNpxCliPath(
  npmExecPath = process.env.npm_execpath,
  nodeExecPath = process.env.npm_node_execpath || process.execPath,
  pathExists = existsSync,
) {
  const fromNpm = resolveNpxCliFromNpmExecPath(npmExecPath, pathExists);
  if (fromNpm) return fromNpm;
  const besideNode = join(dirname(nodeExecPath), "node_modules", "npm", "bin", "npx-cli.js");
  return pathExists(besideNode) ? besideNode : null;
}

export function resolveSpawnCommand(
  cmd,
  args,
  opts = {},
  platform = process.platform,
  env = process.env,
  pathExists = existsSync,
) {
  if (cmd !== "npx" || platform !== "win32") {
    return { cmd, args, opts: { stdio: "ignore", ...opts } };
  }
  const nodeExecPath = env.npm_node_execpath || process.execPath;
  const npxCliPath = resolveNpxCliPath(env.npm_execpath, nodeExecPath, pathExists);
  if (!npxCliPath) return null;
  return {
    cmd: nodeExecPath,
    args: [npxCliPath, ...args.map((arg) => String(arg))],
    opts: { stdio: "ignore", windowsHide: true, ...opts },
  };
}

let _warnedNpxResolution = false;
export function _resetNpxResolutionWarnForTests() {
  _warnedNpxResolution = false;
}

export function spawnP(
  cmd,
  args,
  opts = {},
  platform = process.platform,
  spawnFn = spawn,
  env = process.env,
  pathExists = existsSync,
) {
  const resolved = resolveSpawnCommand(cmd, args, opts, platform, env, pathExists);
  if (!resolved) {
    if (!_warnedNpxResolution) {
      _warnedNpxResolution = true;
      const reason = env.npm_execpath
        ? `npm_execpath (${env.npm_execpath}) and the beside-node npm fallback could not be found`
        : "npm_execpath is unset and the beside-node npm fallback could not be found";
      console.error(
        `[media-use] Cannot run "${cmd}" on Windows: ${reason}. ` +
          `Every "${cmd}" call is being skipped. Install npm with Node, or run via ` +
          "`npx`/`npm run` with a valid npm_execpath.",
      );
    }
    return Promise.resolve({ status: -1 });
  }
  return new Promise((resolve) => {
    const p = spawnFn(resolved.cmd, resolved.args, resolved.opts);
    p.on("exit", (code) => resolve({ status: code ?? -1 }));
    p.on("error", () => resolve({ status: -1 }));
  });
}

function transcodeToWav(bytes, destWav) {
  const td = mkdtempSync(join(tmpdir(), "hf-tts-"));
  const tmp = join(td, "a.mp3");
  writeFileSync(tmp, bytes);
  mkdirSync(dirname(destWav), { recursive: true });
  const ff = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", tmp, "-ar", "44100", "-ac", "1", destWav],
    { stdio: "ignore" },
  );
  rmSync(td, { recursive: true, force: true });
  return ff.status === 0 && existsSync(destWav);
}

// ── synthesis ────────────────────────────────────────────────────────────────
export async function synthesizeOne({
  provider,
  text,
  voiceId,
  lang = "en",
  speed = 1.0,
  wavAbs,
  hyperframesDir,
}) {
  if (provider === "heygen") return synthesizeHeygen({ text, voiceId, lang, speed, wavAbs });
  if (provider === "elevenlabs")
    return synthesizeElevenLabs({ text, voiceId, lang, speed, wavAbs });

  const wavRel = relTo(hyperframesDir, wavAbs);
  const args = ["hyperframes", "tts", writeTmpText(text), "--voice", voiceId, "--output", wavRel];
  if (lang !== "en") args.push("--lang", lang);
  const r = await spawnP("npx", args, { cwd: hyperframesDir });
  return synthResult(r, wavAbs, "kokoro (npx hyperframes tts)");
}

export function synthResult(r, wavAbs, label) {
  if (r.status === 0 && existsSync(wavAbs)) return { ok: true, words: null };
  const why =
    r.status !== 0 ? `${label} exited with status ${r.status}` : `${label} produced no wav file`;
  return { ok: false, words: null, error: why };
}

export async function synthesizeElevenLabs(
  { text, voiceId, lang = "en", speed = 1, wavAbs },
  deps = {},
) {
  const fetchImpl = deps.fetch ?? fetch;
  const transcode = deps.transcodeToWav ?? transcodeToWav;
  const apiKey = deps.apiKey ?? process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { ok: false, words: null, error: "ELEVENLABS_API_KEY is not set" };

  try {
    mkdirSync(dirname(wavAbs), { recursive: true });
    const modelId = deps.modelId ?? chooseElevenLabsModel(lang);
    const outputFormat = process.env.ELEVENLABS_TTS_OUTPUT_FORMAT || "mp3_44100_128";
    const url = new URL(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    );
    url.searchParams.set("output_format", outputFormat);
    const body = {
      text,
      model_id: modelId,
      voice_settings: { speed: Math.min(1.2, Math.max(0.7, Number(speed) || 1)) },
    };
    const normalizedLang = String(lang).toLowerCase().split("-")[0];
    if (modelId !== "eleven_multilingual_v2" && normalizedLang !== "en") {
      body.language_code = normalizedLang;
    }

    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = response.text ? await response.text().catch(() => "") : "";
      return {
        ok: false,
        words: null,
        error: `ElevenLabs TTS HTTP ${response.status}${detail ? ` — ${detail.slice(0, 240)}` : ""}`,
      };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length) return { ok: false, words: null, error: "ElevenLabs TTS returned empty audio" };
    if (!transcode(bytes, wavAbs)) {
      return { ok: false, words: null, error: "wav transcode failed (ffmpeg)" };
    }
    return { ok: true, words: null };
  } catch (error) {
    return { ok: false, words: null, error: error?.message ? String(error.message) : String(error) };
  }
}

export async function synthesizeHeygen({ text, voiceId, lang, speed, wavAbs }, deps = {}) {
  const requestJSON = deps.heygenJSON ?? heygenJSON;
  const authHeaders = deps.heygenAuthHeaders ?? heygenAuthHeaders;
  const fetchImpl = deps.fetch ?? fetch;
  const transcode = deps.transcodeToWav ?? transcodeToWav;
  try {
    const body = { text, voice_id: voiceId, speed };
    if (lang !== "en") body.language = lang;
    const payload = await requestJSON(`/voices/speech`, {
      method: "POST",
      headers: authHeaders(),
      body,
    });
    const inner = payload.data ?? payload;
    if (!inner.audio_url) {
      return { ok: false, words: null, error: "HeyGen /voices/speech returned no audio_url" };
    }
    const res = await fetchImpl(inner.audio_url);
    if (!res.ok) {
      return { ok: false, words: null, error: `audio_url fetch failed: HTTP ${res.status}` };
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (wavAbs.endsWith(".wav")) {
      if (!transcode(bytes, wavAbs)) {
        return { ok: false, words: null, error: "wav transcode failed (ffmpeg)" };
      }
    } else {
      mkdirSync(dirname(wavAbs), { recursive: true });
      writeFileSync(wavAbs, bytes);
    }
    const words = Array.isArray(inner.word_timestamps)
      ? inner.word_timestamps
          .filter((w) => w && typeof w.word === "string" && isFinite(w.start) && isFinite(w.end))
          .filter((w) => !/^<.*>$/.test(w.word.trim()))
          .map((w) => ({ text: w.word, start: w.start, end: w.end }))
      : [];
    return { ok: true, words };
  } catch (e) {
    return { ok: false, words: null, error: e?.message ? String(e.message) : String(e) };
  }
}

export async function transcribeWav({ wavRel, lang = "en", hyperframesDir }) {
  const model = lang === "en" ? "small.en" : "small";
  const td = mkdtempSync(join(tmpdir(), "hf-trans-"));
  const args = ["hyperframes", "transcribe", wavRel, "--model", model, "--dir", td];
  if (lang !== "en") args.push("--language", lang);
  const r = await spawnP("npx", args, { cwd: hyperframesDir });
  let words = null;
  if (r.status === 0) {
    const src = join(td, "transcript.json");
    if (existsSync(src)) {
      try {
        const arr = JSON.parse(readFileSync(src, "utf8"));
        if (Array.isArray(arr) && arr.length) words = arr;
      } catch {}
    }
  }
  rmSync(td, { recursive: true, force: true });
  return words;
}

function writeTmpText(text) {
  const td = mkdtempSync(join(tmpdir(), "hf-txt-"));
  const p = join(td, "line.txt");
  writeFileSync(p, text);
  return p;
}

function relTo(base, abs) {
  const normalizedBase = String(base).replace(/\\/g, "/");
  const normalizedAbs = String(abs).replace(/\\/g, "/");
  return normalizedAbs.startsWith(normalizedBase + "/")
    ? normalizedAbs.slice(normalizedBase.length + 1)
    : abs;
}
