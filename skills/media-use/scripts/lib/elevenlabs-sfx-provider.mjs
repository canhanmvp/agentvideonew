import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateElevenLabsSfx } from "../../audio/scripts/lib/elevenlabs-sfx.mjs";
import { loadProjectEnv } from "./project-env.mjs";

const tempDirs = new Set();
let cleanupRegistered = false;

function registerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  process.once("exit", () => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  });
}

export function inferSfxDuration(intent = "") {
  const match = String(intent).match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?|gi[aâ]y)\b/i);
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? Math.min(30, Math.max(0.5, seconds)) : null;
}

export async function elevenLabsSfxGenerate(intent, ctx = {}, deps = {}) {
  loadProjectEnv(ctx.projectDir || process.cwd());
  if (!process.env.ELEVENLABS_API_KEY && !deps.apiKey) return null;

  const generated = await (deps.generate || generateElevenLabsSfx)(
    {
      text: intent,
      apiKey: deps.apiKey,
      durationSeconds:
        ctx.durationSeconds || process.env.ELEVENLABS_SFX_DURATION_SECONDS || inferSfxDuration(intent),
      promptInfluence: ctx.promptInfluence,
      loop: ctx.loop,
    },
    deps,
  );

  const dir = mkdtempSync(join(tmpdir(), "hf-elevenlabs-sfx-"));
  tempDirs.add(dir);
  registerCleanup();
  const localPath = join(dir, "effect.mp3");
  writeFileSync(localPath, generated.bytes);

  return {
    localPath,
    ext: ".mp3",
    source: "generated",
    metadata: {
      description: intent,
      duration: generated.requestedDuration ?? null,
      provider: "elevenlabs.sfx",
      provenance: {
        prompt: intent,
        model_id: generated.modelId,
        output_format: generated.outputFormat,
        character_cost: generated.characterCost,
      },
    },
  };
}
