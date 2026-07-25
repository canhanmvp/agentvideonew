const ELEVENLABS_SFX_ENDPOINT = "https://api.elevenlabs.io/v1/sound-generation";

const clampDuration = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(30, Math.max(0.5, n));
};

export function elevenLabsSfxAvailable() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

/**
 * Generate one sound effect through ElevenLabs and return bytes plus billing
 * metadata. The caller owns persistence so this helper works in both the shared
 * audio engine and the media-use provider registry.
 */
export async function generateElevenLabsSfx(options = {}, deps = {}) {
  const apiKey = options.apiKey || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  const text = String(options.text || "").trim();
  if (!text) throw new Error("ElevenLabs SFX needs a non-empty text prompt");

  const outputFormat =
    options.outputFormat || process.env.ELEVENLABS_SFX_OUTPUT_FORMAT || "mp3_44100_128";
  const modelId = options.modelId || process.env.ELEVENLABS_SFX_MODEL || "eleven_text_to_sound_v2";
  const durationSeconds = clampDuration(options.durationSeconds);
  const promptInfluence = Number(
    options.promptInfluence ?? process.env.ELEVENLABS_SFX_PROMPT_INFLUENCE,
  );

  const body = {
    text,
    loop: Boolean(options.loop),
    model_id: modelId,
  };
  if (durationSeconds != null) body.duration_seconds = durationSeconds;
  if (Number.isFinite(promptInfluence)) {
    body.prompt_influence = Math.min(1, Math.max(0, promptInfluence));
  }

  const url = new URL(ELEVENLABS_SFX_ENDPOINT);
  url.searchParams.set("output_format", outputFormat);
  const fetchImpl = deps.fetch || fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `ElevenLabs sound generation failed: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 240)}` : ""}`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error("ElevenLabs sound generation returned an empty audio file");
  return {
    bytes,
    modelId,
    outputFormat,
    requestedDuration: durationSeconds,
    characterCost: response.headers?.get?.("character-cost") || null,
    requestId: response.headers?.get?.("request-id") || null,
  };
}
