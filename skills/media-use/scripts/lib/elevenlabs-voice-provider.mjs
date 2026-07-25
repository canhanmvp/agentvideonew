import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProjectEnv } from "./project-env.mjs";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const tempDirs = new Set();
let cleanupRegistered = false;

function registerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  process.once("exit", () => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  });
}

export function looksVietnamese(text = "") {
  return /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i.test(
    String(text),
  );
}

export function chooseElevenLabsModel(text, configuredModel = process.env.ELEVENLABS_TTS_MODEL) {
  if (configuredModel) return configuredModel;
  return looksVietnamese(text) ? "eleven_flash_v2_5" : "eleven_multilingual_v2";
}

export async function elevenLabsTtsGenerate(intent, ctx = {}, deps = {}) {
  loadProjectEnv(ctx.projectDir || process.cwd());
  const apiKey = deps.apiKey || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const voiceId = ctx.voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const modelId = chooseElevenLabsModel(intent, ctx.modelId);
  const outputFormat = process.env.ELEVENLABS_TTS_OUTPUT_FORMAT || "mp3_44100_128";
  const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`);
  url.searchParams.set("output_format", outputFormat);

  const fetchImpl = deps.fetch || fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({ text: intent, model_id: modelId }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `ElevenLabs TTS failed: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 240)}` : ""}`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("ElevenLabs TTS returned an empty audio file");
  const dir = mkdtempSync(join(tmpdir(), "hf-elevenlabs-tts-"));
  tempDirs.add(dir);
  registerCleanup();
  const localPath = join(dir, "voice.mp3");
  writeFileSync(localPath, bytes);

  return {
    localPath,
    ext: ".mp3",
    source: "generated",
    metadata: {
      description: intent,
      provider: "elevenlabs.tts",
      provenance: {
        prompt: intent,
        voice_id: voiceId,
        model_id: modelId,
        output_format: outputFormat,
        character_cost: response.headers?.get?.("character-cost") || null,
      },
    },
  };
}
