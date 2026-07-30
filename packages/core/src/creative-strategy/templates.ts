import type { AudioMoodCandidate, ViralTemplate, ViralTemplateBeat } from "./types.js";

type TemplateDefinition = Omit<ViralTemplate, "beatCount" | "beats"> & {
  beats5: ViralTemplateBeat[];
  beats7: ViralTemplateBeat[];
};

const beat = (
  role: string,
  narrativeJob: string,
  durationShare: number,
  energy: number,
  transitionRole: ViralTemplateBeat["transitionRole"],
  audioOpportunity: ViralTemplateBeat["audioOpportunity"] = "none",
): ViralTemplateBeat => ({
  role,
  narrativeJob,
  durationShare,
  energy,
  transitionRole,
  audioOpportunity,
});

const DEFINITIONS: TemplateDefinition[] = [
  {
    id: "insight-loop",
    name: "Insight Loop",
    summary: "Earn attention with a gap, reveal the mechanism, then land why it matters.",
    beats5: [
      beat("hook", "Open a specific curiosity gap.", 0.14, 5, "cut", "impact"),
      beat(
        "context-insight",
        "Set context and expose the counterintuitive insight.",
        0.23,
        3,
        "connective",
      ),
      beat("explanation", "Make the mechanism understandable.", 0.25, 4, "connective", "reveal"),
      beat(
        "proof-consequence",
        "Ground the claim and show the consequence.",
        0.23,
        5,
        "hero",
        "impact",
      ),
      beat("cta", "Close the loop with one action.", 0.15, 3, "connective", "seam"),
    ],
    beats7: [
      beat("hook", "Open a specific curiosity gap.", 0.1, 5, "cut", "impact"),
      beat("context", "Give only the context needed to understand the gap.", 0.13, 3, "connective"),
      beat("insight", "Reveal the counterintuitive insight.", 0.17, 5, "hero", "reveal"),
      beat("explanation", "Explain the mechanism one layer at a time.", 0.2, 4, "connective"),
      beat("proof", "Highlight the strongest evidence.", 0.16, 5, "hero", "impact"),
      beat("consequence", "Show what changes if the viewer understands it.", 0.13, 4, "connective"),
      beat("cta", "Close the loop with one action.", 0.11, 3, "connective", "seam"),
    ],
  },
  {
    id: "myth-flip",
    name: "Myth Flip",
    summary: "Start with the familiar belief, break it with evidence, and replace it.",
    beats5: [
      beat("belief", "State the recognizable belief.", 0.15, 4, "cut"),
      beat("doubt-reveal", "Create doubt and reveal the better frame.", 0.23, 5, "hero", "impact"),
      beat("mechanism", "Explain why the replacement is true.", 0.24, 4, "connective", "reveal"),
      beat("evidence-implication", "Prove it and show the implication.", 0.23, 5, "hero", "impact"),
      beat("cta", "Ask the viewer to apply the new frame.", 0.15, 3, "connective"),
    ],
    beats7: [
      beat("belief", "State the recognizable belief.", 0.11, 4, "cut"),
      beat("doubt", "Expose the crack in that belief.", 0.12, 4, "connective"),
      beat("reveal", "Name the better frame.", 0.16, 5, "hero", "impact"),
      beat("mechanism", "Explain why the replacement is true.", 0.2, 4, "connective", "reveal"),
      beat("evidence", "Ground the replacement in evidence.", 0.16, 5, "hero", "impact"),
      beat("implication", "Show what the new frame changes.", 0.14, 4, "connective"),
      beat("cta", "Ask the viewer to apply the new frame.", 0.11, 3, "connective"),
    ],
  },
  {
    id: "problem-escalation",
    name: "Problem Escalation",
    summary: "Make a costly problem concrete before turning toward the solution.",
    beats5: [
      beat("hook", "Name the painful outcome.", 0.14, 5, "cut", "impact"),
      beat("problem-agitation", "Show the problem compounding.", 0.24, 5, "connective"),
      beat(
        "turn-solution",
        "Create the turn and introduce the solution.",
        0.25,
        4,
        "hero",
        "reveal",
      ),
      beat("proof", "Demonstrate that the solution resolves the pain.", 0.22, 5, "hero", "impact"),
      beat("cta", "Give one next action.", 0.15, 3, "connective"),
    ],
    beats7: [
      beat("hook", "Name the painful outcome.", 0.1, 5, "cut", "impact"),
      beat("problem", "Make the root problem recognizable.", 0.14, 4, "connective"),
      beat("agitation", "Show the cost compounding.", 0.15, 5, "connective"),
      beat("turn", "Break the escalation with a new possibility.", 0.13, 3, "hero", "reveal"),
      beat("solution", "Show how the solution works.", 0.2, 4, "connective"),
      beat("proof", "Demonstrate that the pain is resolved.", 0.16, 5, "hero", "impact"),
      beat("cta", "Give one next action.", 0.12, 3, "connective"),
    ],
  },
  {
    id: "before-after-bridge",
    name: "Before–After–Bridge",
    summary: "Contrast the current state with the desired one, then make the bridge credible.",
    beats5: [
      beat("before-cost", "Show the current state and its cost.", 0.2, 4, "cut"),
      beat("after", "Make the desired state visible.", 0.18, 5, "hero", "reveal"),
      beat("bridge", "Explain the shortest credible path between them.", 0.28, 4, "connective"),
      beat("proof", "Demonstrate the bridge working.", 0.2, 5, "hero", "impact"),
      beat("cta", "Invite the first step.", 0.14, 3, "connective"),
    ],
    beats7: [
      beat("before", "Show the current state.", 0.11, 3, "cut"),
      beat("cost", "Make its hidden cost concrete.", 0.14, 5, "connective", "impact"),
      beat("after", "Make the desired state visible.", 0.15, 5, "hero", "reveal"),
      beat("bridge", "Name the bridge.", 0.13, 3, "connective"),
      beat("demonstration", "Walk through the bridge.", 0.21, 4, "connective", "reveal"),
      beat("proof", "Show the result holding up.", 0.15, 5, "hero", "impact"),
      beat("cta", "Invite the first step.", 0.11, 3, "connective"),
    ],
  },
  {
    id: "list-escalation",
    name: "List Escalation",
    summary: "Use escalating examples to reveal a pattern larger than any one item.",
    beats5: [
      beat("hook", "Promise a useful pattern, not just a list.", 0.14, 5, "cut"),
      beat("items-one-two", "Build recognition with the first examples.", 0.24, 4, "connective"),
      beat("item-three-pattern", "Escalate and reveal the pattern.", 0.28, 5, "hero", "reveal"),
      beat("consequence", "Show why the pattern matters.", 0.2, 4, "connective", "impact"),
      beat("cta", "Give one action based on the pattern.", 0.14, 3, "connective"),
    ],
    beats7: [
      beat("hook", "Promise a useful pattern, not just a list.", 0.1, 5, "cut"),
      beat("item-one", "Establish the list grammar.", 0.13, 3, "connective"),
      beat("item-two", "Build recognition.", 0.13, 4, "connective"),
      beat("item-three", "Escalate beyond the obvious.", 0.14, 5, "connective", "reveal"),
      beat("pattern", "Reveal what connects the items.", 0.2, 5, "hero", "impact"),
      beat("consequence", "Show why the pattern matters.", 0.17, 4, "connective"),
      beat("cta", "Give one action based on the pattern.", 0.13, 3, "connective"),
    ],
  },
];

export const AUDIO_MOODS: AudioMoodCandidate[] = [
  {
    id: "ambient",
    name: "Ambient",
    description: "Calm space for reflective or educational stories.",
    query: "minimal ambient underscore, warm texture, restrained pulse",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Controlled build for premium or high-stakes stories.",
    query: "cinematic build, modern strings and percussion, clear climax",
  },
  {
    id: "lo-fi",
    name: "Lo-fi",
    description: "Relaxed momentum for approachable explanations.",
    query: "warm lo-fi beat, soft drums, unobtrusive melodic loop",
  },
  {
    id: "piano",
    name: "Piano",
    description: "Emotional clarity for personal transformation.",
    query: "minimal modern piano, subtle pads, hopeful progression",
  },
  {
    id: "dark",
    name: "Dark",
    description: "Tension for hidden-cost or contrarian angles.",
    query: "dark minimal pulse, low texture, restrained tension",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Use a project-specific music query.",
    query: "",
  },
];

export function viralTemplatesForDuration(durationSeconds: number): ViralTemplate[] {
  const beatCount: 5 | 7 = durationSeconds < 25 ? 5 : 7;
  return DEFINITIONS.map(({ beats5, beats7, ...definition }) => ({
    ...definition,
    beatCount,
    beats: beatCount === 5 ? beats5 : beats7,
  }));
}
