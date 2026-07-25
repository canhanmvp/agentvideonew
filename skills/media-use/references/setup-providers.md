# Setup and providers — install, auth, RAM ladders, forcing a provider

## Project environment

Copy the repository example and add only the keys you use:

```bash
cp .env.example .env
```

```dotenv
PEXELS_API_KEY=          # stock video search/download
ELEVENLABS_API_KEY=      # cloud TTS + generated long-tail SFX
GEMINI_API_KEY=          # optional Google Lyria background music
```

The provider loader checks `.env` first and accepts `.env.local` as a compatibility fallback. Both files are gitignored. Shell environment variables always take precedence.

Optional tuning:

```dotenv
ELEVENLABS_VOICE_ID=
ELEVENLABS_TTS_MODEL=eleven_flash_v2_5
ELEVENLABS_SFX_MODEL=eleven_text_to_sound_v2
ELEVENLABS_SFX_PROMPT_INFLUENCE=0.3
PEXELS_VIDEO_ORIENTATION=portrait
PEXELS_VIDEO_SIZE=medium
PEXELS_VIDEO_LOCALE=en-US
PEXELS_VIDEO_PER_PAGE=40
```

For Vietnamese TTS, `eleven_flash_v2_5` is selected automatically by the direct media-use provider unless `ELEVENLABS_TTS_MODEL` overrides it.

## HeyGen free-usage path

Install the HeyGen CLI through its verified release instructions, then run:

```bash
heygen update
heygen auth login --oauth
```

OAuth unlocks the web-plan allowance for catalog search, TTS, and avatar video. An API key follows normal API billing. Verify the complete local setup with:

```bash
node <SKILL_DIR>/scripts/resolve.mjs --doctor
```

## Provider cascades

| Type | Provider order |
| --- | --- |
| `video` | Pexels stock search → HeyGen avatar generation → local LTX |
| `voice` | HeyGen TTS → ElevenLabs TTS → local Kokoro |
| `sfx` | HeyGen retrieval → bundled SFX → ElevenLabs generation |
| `bgm` | HeyGen retrieval; without HeyGen, Google Lyria → local MusicGen |
| `image` | HeyGen search → local mflux → Codex image generation |
| `icon` | HeyGen asset search |
| `logo` | svgl → simple-icons → GitHub organization avatar → domain favicon |
| `grade/lut` | local presets, parameterized correction, deterministic cube generation |

Pexels results are downloaded to the project and record the asset page, contributor name, and contributor page in provenance. Applications using the Pexels API must surface a prominent Pexels link and should credit contributors when possible.

Bundled SFX are preferred over generation because they are deterministic and free. ElevenLabs is used for long-tail cues that retrieval and the local library cannot satisfy.

## Force or disable providers

Force one provider with its full name or prefix:

```bash
node <SKILL_DIR>/scripts/resolve.mjs \
  --type video \
  --intent "woman planning her day, portrait 6-10 seconds" \
  --provider pexels \
  --project ./my-video
```

```bash
node <SKILL_DIR>/scripts/resolve.mjs \
  --type voice \
  --intent "Xin chào, đây là phần giới thiệu." \
  --provider elevenlabs \
  --project ./my-video
```

`--local-only` skips every network provider, including free Pexels and HeyGen search. Cached project/global assets and installed local providers remain available.

## Local tools

Only `ffmpeg`/`ffprobe` are strictly required for the core media pipeline. Optional local providers:

| Tool | Serves | Install |
| --- | --- | --- |
| `ffmpeg`/`ffprobe` | probing, transcode, cut, loudness and duration checks | system package |
| `heygen` | catalog, TTS and avatar video | verified HeyGen CLI, then OAuth login |
| `mflux-generate` | local FLUX image generation | see `scripts/lib/local-models.mjs` |
| `parakeet-mlx` | local transcription | see `scripts/lib/local-models.mjs` |
| `ltx-2-mlx` | local video generation | see `scripts/lib/local-models.mjs` |
| `npx hyperframes` | Kokoro TTS, whisper.cpp fallback, background removal | HyperFrames CLI |

The RAM-graded local-model shortlist and exact invocation commands live in `scripts/lib/local-models.mjs`.
