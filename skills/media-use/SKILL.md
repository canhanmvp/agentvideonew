---
name: media-use
description: Agent Media OS, the single skill for every media need in a HyperFrames project. Resolve BGM, SFX, stock video, image, icon, brand logo, voice, color grade, or LUT into a frozen local file or paste-ready block + ledger record; generate via TTS, music, image, video, and sound models when retrieval misses; produce voiceover, transcription, captions, and background removal through one shared audio engine; operate on media; and reuse assets across projects.
---

# media-use

The media OS for HyperFrames: resolve · generate · operate · remember — every media type, one skill, zero context noise.

First run: copy `.env.example` to `.env`, add the provider keys you intend to use, then verify with `node <SKILL_DIR>/scripts/resolve.mjs --doctor`. Setup and provider cascades: `references/setup-providers.md`.

## Resolve — the one verb

```bash
node <SKILL_DIR>/scripts/resolve.mjs --type <type> --intent "<description>" --project <dir>
```

Returns one line: `resolved <id> → <path> (<type>, <metadata>)`. Search noise stays on disk; remote media is frozen locally for deterministic rendering.

| Type    | One-line intent                                                     |
| ------- | ------------------------------------------------------------------- |
| `video` | Pexels stock footage first, then HeyGen/LTX generation              |
| `bgm`   | background music retrieval or Lyria/MusicGen generation             |
| `sfx`   | HeyGen retrieval → bundled library → ElevenLabs generation          |
| `image` | photos and backgrounds; search first, generation fallback           |
| `icon`  | icons and symbols with transparent assets preferred                 |
| `logo`  | official marks: svgl → simple-icons → GitHub avatar → favicon       |
| `voice` | HeyGen → ElevenLabs → local Kokoro TTS                              |
| `grade` | measured correction candidate; broader polish uses Media Treatments |
| `lut`   | user-provided or explicitly chosen reusable validated `.cube` file  |

Pexels results preserve the asset page, creator name, and creator page in provenance. Surface a prominent Pexels link and contributor credit when the product UI presents those assets.

Before resolving fresh, list reusable candidates with `--candidates` and judge fit yourself. Reuse rules, flags, ingest (`--from`), and adopt are in `references/resolve.md`.

## Treat broad visual feedback as media intent

When a user explicitly asks to fix, polish, stylize, obscure, emphasize, or reveal photographic media, read `references/media-treatments.md` even if they do not name color grading or an effect. Inspect the real `<img>`/`<video>`, choose one primary intent, then use deterministic persistence and verification.

Use a matching recipe as an optional tested seed, or inspect `hyperframes media-treatment --capabilities --json`, then request one relevant family/effect with `--capability <id>` and assemble a custom treatment from canonical controls. Never load `--all` for ordinary authoring. Add only source-justified bounded tuning and compatible parts, never effects merely to make the result look more sophisticated. Persist the final combined payload with `hyperframes media-treatment`.

Use one progressively escalating workflow. For video, inspect one labeled early/middle/late contact sheet rather than reading frames separately. Apply one candidate and inspect one after-sheet for ordinary correction or polish. Escalate only when the result is ambiguous, temporal, stylized, LUT-based, HDR/LOG-sensitive, private, or brand-critical.

Do not generate a `.cube` LUT merely to encode exposure, shadows, contrast, or warmth. Use a LUT only when the user supplies one or the selected treatment explicitly owns one. `resolve --type grade --for ... --analyze` is measurement evidence, not permission to replace the chosen treatment with a generated LUT.

## Be proactive — run one media opportunity pass

Surface an opportunity only when a concrete signal is present:

| Signal detected                                   | Offer                                                 |
| ------------------------------------------------- | ----------------------------------------------------- |
| Script or on-screen text with no voiceover        | TTS voiceover through the audio engine                |
| Placeholder or irrelevant footage                 | Pexels stock `video` with local freeze and provenance |
| Emoji or a styled `<div>` standing in for an icon | resolve a real `icon`                                 |
| Placeholder, tiny, or upscaled image              | a better `image`                                      |
| Hard cuts with no sonic support                   | transition `sfx`                                      |
| Piece over ~10 seconds with no music bed          | `bgm`                                                 |
| Under/over-exposed or color-cast footage          | corrective `grade`                                    |
| Flat or off-topic photographic media              | one source-appropriate treatment                      |

Rules: grounded, not generic; propose a specific fix; ask once per project; never silently mutate user media.

## Where to look

| Task                                                            | Read                             |
| --------------------------------------------------------------- | -------------------------------- |
| resolve / reuse / adopt / ingest / provider cascade             | `references/resolve.md`          |
| provider keys, auth, local models, `--local-only`, `--provider` | `references/setup-providers.md`  |
| voiceover / TTS / music / SFX / captions / transcription        | `references/audio.md`            |
| color grading, LUTs, smart grade                                | `references/grading.md`          |
| cut / reframe / transform                                       | `references/operations.md`       |
| treatments, realtime effects, overlays, reveals                 | `references/media-treatments.md` |
| remembered preferences and recipes                              | `references/memory.md`           |
| ownership, usage stats, telemetry, privacy                      | `references/meta.md`             |
