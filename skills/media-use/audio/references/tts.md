# Text To Speech

The shared audio engine selects providers in this order:

| Order | Provider | Trigger | Word timestamps | Output |
| --- | --- | --- | --- | --- |
| 1 | HeyGen Starfish | HeyGen OAuth/API credential | Native timestamps | MP3 → WAV |
| 2 | ElevenLabs | `ELEVENLABS_API_KEY` | Transcribed after synthesis | MP3 → WAV |
| 3 | Kokoro-82M | Local fallback | Transcribed after synthesis | WAV |

`npx hyperframes tts` itself remains the local Kokoro command. Full workflows call `audio/scripts/audio.mjs`, which can use all three providers.

## ElevenLabs

The audio engine calls the ElevenLabs REST API directly; the Python SDK is not required.

```dotenv
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
# Optional override:
# ELEVENLABS_TTS_MODEL=eleven_flash_v2_5
```

Model selection when no override is configured:

- `lang: "vi"` or `vi-VN` → `eleven_flash_v2_5`, because Vietnamese is not supported by Multilingual v2.
- Other languages → `eleven_multilingual_v2`.

The request passes `voice_settings.speed` bounded to ElevenLabs' supported `0.7–1.2` range. Cloud MP3 output is transcoded to 44.1 kHz mono WAV for the rest of the HyperFrames pipeline.

Example request:

```json
{
  "provider": "elevenlabs",
  "lang": "vi",
  "speed": 1.0,
  "voice": "YOUR_VOICE_ID",
  "lines": [
    { "id": "intro", "text": "Xin chào, đây là video được tạo tự động." }
  ],
  "bgm": { "mode": "none" }
}
```

```bash
node skills/media-use/audio/scripts/audio.mjs \
  --request ./audio_request.json \
  --hyperframes . \
  --out ./audio_meta.json \
  --only tts
```

## HeyGen with native timestamps

For a one-off HeyGen call plus word timestamps:

```bash
node skills/media-use/audio/scripts/heygen-tts.mjs \
  "Welcome to HyperFrames." \
  -o narration.wav \
  --words narration.words.json
```

HeyGen credentials resolve from shell variables, a project `.env`, or `~/.heygen/credentials`. Starfish voice IDs are required.

## Kokoro local fallback

```bash
npx hyperframes tts "Welcome to HyperFrames" -o narration.wav
```

Common choices:

| Content | Voice |
| --- | --- |
| Product demo | `af_heart`, `af_nova` |
| Tutorial | `am_adam`, `bf_emma` |
| Marketing | `af_sky`, `am_michael` |
| Documentation | `bf_emma`, `bm_george` |

Run `npx hyperframes tts --list` for the installed set. Non-English Kokoro phonemization may require `espeak-ng`.

## Provider guidance

| Goal | Provider |
| --- | --- |
| Best integrated captions with native word timestamps | HeyGen |
| Broad cloud voice catalog and Vietnamese support | ElevenLabs |
| Offline/private iteration | Kokoro |

## Requirements and failure behavior

HeyGen and ElevenLabs return compressed audio, so `ffmpeg` is required for WAV output. Failed TTS lines are omitted and recorded as anomalies rather than aborting the complete render.

ElevenLabs and Kokoro do not return word timings in this pipeline. The engine transcribes the generated WAV so captions receive the same `[{ id, text, start, end }]` shape used by HeyGen.
