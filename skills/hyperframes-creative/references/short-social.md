# Short-social creative strategy

Opt-in profile for narrative 9:16 videos lasting 15–60 seconds. It augments
`faceless-explainer`, `product-launch-video`, and `general-video`; it is not a
separate workflow. Activate only when `BRIEF.md` contains:

```yaml
format_profile: short-social
aspect: 1080x1920
length: 15s
```

Projects without `format_profile` keep their existing behavior.

## Required sequence

`Brief → Evidence → Angle candidates → Hook test → Template/style selection → Storyboard → Full polish → Check → Preview`

Before authoring `STORYBOARD.md`, write
`.hyperframes/creative-strategy.json` with `version: 1` and
`profile: short-social`. Preserve the brief language in every candidate.

The manifest contains:

- sourced `evidence` records (`id`, `claim`, `source`, optional `locator`);
- exactly five angles: `surprising-truth`, `hidden-cost`, `transformation`,
  `contrarian`, `practical-mechanism`;
- exactly three hooks per angle: `open-loop`, `concrete-stakes`,
  `contrarian-interruption`;
- all five duration-adapted templates;
- three recommended style candidates from the eight styles in
  `visual-styles.md` (the manifest may include all eight);
- Ambient, Cinematic, Lo-fi, Piano, Dark, and Custom audio choices;
- one atomic `selection` with angle, hook, template, style, audio mood, and a
  plain-language `reason`.

The public TypeScript contract is
`@hyperframes/core/creative-strategy` →
`CreativeStrategyManifestV1`. Validate before storyboard generation:

```bash
npx hyperframes strategy check . --json
npx hyperframes strategy check . --require-selection --json
```

The first command gates a proposal. The second gates the selected strategy.

## Evidence and hard failures

Every angle and hook cites evidence ids. Do not invent a statistic, result, or
causal claim to make a hook stronger. Mark a hook ineligible when any condition
holds:

- no valid evidence;
- its evidence does not support the angle promise;
- generic wording that could introduce any topic;
- bait-and-switch between opening and delivered value;
- estimated read time exceeds the hook beat.

An ineligible angle or hook remains visible for comparison but cannot be
selected.

## Creative-fit scoring

Scores are decision support, never predicted retention and never proof that a
video will go viral. Dimension values are 0–5; weighted totals are 0–100.

Angle weights:

| Dimension         | Weight |
| ----------------- | -----: |
| Audience fit      |    25% |
| Proof strength    |    25% |
| Visual potential  |    20% |
| Novelty           |    15% |
| Emotional tension |    15% |

Hook weights:

| Dimension        | Weight |
| ---------------- | -----: |
| Clarity          |    20% |
| Curiosity        |    20% |
| Specificity      |    15% |
| Audience fit     |    15% |
| Credibility      |    15% |
| Visual potential |    15% |

In collaborative mode, open Studio at `?view=strategy`; the user chooses.
In autonomous mode, select the highest-scoring eligible combination and record
why it fits the evidence, audience, and visual medium. Never call the score
“retention”, “viral probability”, or “proven”.

## Adaptive templates

| Template            | Seven-beat arc                                                                      |
| ------------------- | ----------------------------------------------------------------------------------- |
| Insight Loop        | Hook → Context → Counterintuitive Insight → Explanation → Proof → Consequence → CTA |
| Myth Flip           | Common belief → Doubt → Reveal → Mechanism → Evidence → Implication → CTA           |
| Problem Escalation  | Hook → Problem → Agitation → Turn → Solution → Proof → CTA                          |
| Before–After–Bridge | Before → Cost → Desired after → Bridge → Demonstration → Proof → CTA                |
| List Escalation     | Hook → Items that escalate → Pattern reveal → Consequence → CTA                     |

For 15–24 seconds, use the manifest's five-beat adaptation: merge
setup/insight and proof/consequence. For 25–60 seconds, keep seven beats.
The hook is visible within the first 0.5 seconds and the value proposition is
clear by the end of beat 2. Every beat/scene owns exactly one narrative job and
one focal reveal.

The template beat records are downstream instructions:
`durationShare`, `energy`, `transitionRole`, and `audioOpportunity` must flow
into storyboard timing, motion direction, and audio cues.

## Materialize the selection

After selection:

1. Copy the selected style's palette, typography, density, texture, motion
   intensity, and use-case constraints into the project's canonical `frame.md`.
   Do not substitute a different preset later.
2. Write these `STORYBOARD.md` frontmatter keys:
   `strategy`, `angle`, `hook`, `template`, `style`, and `music`.
3. Make `arc` match the selected template. Carry each template beat into one
   scene, except the documented five-beat merges.
4. Keep claims traceable to evidence. The storyboard may simplify wording but
   may not strengthen the promise.

## Full-polish pass

Run this after storyboard timing is real and before the final check:

- **Pacing:** calculate on-screen read time; keep the hook readable, reset
  attention every 4–8 seconds, and give the CTA enough dwell to read once.
- **Motion:** follow one energy curve across the video; never use the same
  direction/ease for three consecutive scenes; keep 2–3 transition families and
  only 1–2 hero transitions.
- **Continuity:** carry one motif, palette, anchor, and camera direction across
  seams so scenes feel like one video, not unrelated slides.
- **Captions:** short phrase groups, one highlighted keyword, word-timed
  alignment, and the vertical safe zone from the caption contract.
- **Audio:** duck BGM under narration. Use 2–4 SFX for 15–24 seconds and 3–6 for
  25–60 seconds. Place cues at reveal offsets, not merely at frame starts.
- **Gate:** selected strategy valid; storyboard frontmatter matches it; no
  unsupported claims; SFX offsets fit frame duration; only then run
  `hyperframes lint`, `hyperframes check`, and preview.

Rendering multiple MP4 hook variants, analytics ingestion, and retention
prediction are out of scope for v1.
