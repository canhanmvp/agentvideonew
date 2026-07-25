# Sound effects (SFX)

Named sound effects are resolved by the shared audio engine (`scripts/audio.mjs` → `scripts/lib/sfx.mjs`). Each distinct cue name uses this cascade:

1. **HeyGen catalog retrieval** when a HeyGen credential is available.
2. **Bundled SFX library** for deterministic common effects.
3. **ElevenLabs text-to-sound generation** when `ELEVENLABS_API_KEY` is configured and the first two routes miss.

There is no separate `npx hyperframes sfx` command. Workflows declare cues in `audio_request.json`.

## Request and output

```json
{
  "lines": [
    {
      "id": "scene-3",
      "text": "Your progress is now synchronized.",
      "sfx": ["clean digital whoosh", "soft confirmation chime"]
    }
  ]
}
```

The engine writes:

```jsonc
{
  "id": "scene-3",
  "name": "clean digital whoosh",
  "file": "assets/sfx/clean-digital-whoosh.mp3",
  "source": "heygen" | "local" | "elevenlabs",
  "offset_s": 0,
  "duration_s": 0.8,
  "volume": 0.35
}
```

The same cue name is resolved once per run and reused across multiple scene IDs.

## HeyGen retrieval

The engine searches `/v3/audio/sounds` with `type=sound_effects`, `limit=3`, and `min_score=0.4`. Concrete prompts perform better than vague mood descriptions.

## Bundled library

The bundled manifest contains common deterministic effects such as `whoosh`, `pop`, `click`, `chime`, `riser`, `impact-bass-1`, `glitch-1`, and `typing`. Matches are copied into the project's `assets/sfx/` folder with known duration metadata.

## ElevenLabs generation

```dotenv
ELEVENLABS_API_KEY=
# Optional:
# ELEVENLABS_SFX_MODEL=eleven_text_to_sound_v2
# ELEVENLABS_SFX_PROMPT_INFLUENCE=0.3
# ELEVENLABS_SFX_OUTPUT_FORMAT=mp3_44100_128
```

The engine calls `POST /v1/sound-generation`. Generated files are measured with `ffprobe` and stored locally before rendering. ElevenLabs is intentionally the last rung because it is metered and less deterministic than retrieval or bundled assets.

Name long-tail prompts precisely, for example:

- `soft sci-fi interface confirmation with a glassy tail`
- `subtle paper unfolding transition`
- `deep cinematic logo impact without distortion`

## Rules

- Keep SFX near volume `0.35`, underneath narration and BGM.
- A missing or failed effect records an anomaly and never blocks the render.
- Prefer one specific physical or UI event per prompt.
- Reuse the resolved asset for repeated cue names.
- Do not generate common effects when the bundled library already contains a suitable deterministic file.
