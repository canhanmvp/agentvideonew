import { describe, expect, it } from "vitest";
import {
  AUDIO_MOODS,
  hookDisqualifiers,
  scoreAngle,
  scoreHook,
  validateCreativeStrategy,
  viralTemplatesForDuration,
  type AngleType,
  type CreativeStrategyManifestV1,
  type StyleCandidate,
} from "./index.js";
import { shortSocial45SecondFixture } from "../tests/fixtures/creativeStrategy.js";

function styles(): StyleCandidate[] {
  return [
    {
      id: "shadow-cut",
      name: "Shadow Cut",
      summary: "High-contrast editorial framing.",
      palette: ["#0a0a0a", "#f5f5f5", "#60a5fa"],
      typography: "display sans + mono",
      density: "medium",
      texture: "grain",
      motionIntensity: "high",
      useWhen: "The idea needs tension.",
      recommended: true,
    },
  ];
}

function validManifest(durationSeconds = 30, language = "vi"): CreativeStrategyManifestV1 {
  const angleDimensions = {
    audienceFit: 4,
    proofStrength: 4,
    visualPotential: 4,
    novelty: 4,
    emotionalTension: 4,
  };
  const hookDimensions = {
    clarity: 4,
    curiosity: 4,
    specificity: 4,
    audienceFit: 4,
    credibility: 4,
    visualPotential: 4,
  };
  const evidence = [{ id: "e1", claim: "A grounded claim.", source: "brief" }];
  const angleTypes: AngleType[] = [
    "surprising-truth",
    "hidden-cost",
    "transformation",
    "contrarian",
    "practical-mechanism",
  ];
  const angles = angleTypes.map((type, index) => ({
    id: `a${index + 1}`,
    type,
    title: `Angle ${index + 1}`,
    insight: "Grounded insight.",
    promise: "Grounded promise.",
    evidenceIds: ["e1"],
    risk: "May need context.",
    score: scoreAngle(angleDimensions),
    eligible: true,
    disqualifiers: [],
    recommended: index === 0,
  }));
  const patterns = ["open-loop", "concrete-stakes", "contrarian-interruption"] as const;
  const hooks = angles.flatMap((angle) =>
    patterns.map((pattern, index) => ({
      id: `${angle.id}-h${index + 1}`,
      angleId: angle.id,
      pattern,
      copy: "What changes when this becomes clear?",
      firstVisual: "A concrete visual.",
      evidenceIds: ["e1"],
      estimatedReadSeconds: 1.5,
      score: scoreHook(hookDimensions),
      eligible: true,
      disqualifiers: [],
      recommended: angle.id === "a1" && index === 0,
    })),
  );
  const templates = viralTemplatesForDuration(durationSeconds);
  return {
    version: 1,
    profile: "short-social",
    durationSeconds,
    language,
    message: "One message.",
    audience: "Creators",
    status: "selected",
    evidence,
    angles,
    hooks,
    templates,
    styles: styles(),
    audioMoods: AUDIO_MOODS,
    selection: {
      angleId: "a1",
      hookId: "a1-h1",
      templateId: "insight-loop",
      styleId: "shadow-cut",
      audioMood: "dark",
    },
  };
}

describe("creative strategy scoring", () => {
  it("uses the documented angle weights", () => {
    expect(
      scoreAngle({
        audienceFit: 5,
        proofStrength: 5,
        visualPotential: 0,
        novelty: 0,
        emotionalTension: 0,
      }).total,
    ).toBe(50);
  });

  it("uses the documented hook weights", () => {
    expect(
      scoreHook({
        clarity: 5,
        curiosity: 5,
        specificity: 0,
        audienceFit: 0,
        credibility: 0,
        visualPotential: 0,
      }).total,
    ).toBe(40);
  });

  it("disqualifies an ungrounded, mismatched, over-budget hook", () => {
    expect(
      hookDisqualifiers({
        evidenceIds: [],
        knownEvidenceIds: new Set(["e1"]),
        angleEvidenceIds: ["e1"],
        estimatedReadSeconds: 3,
        hookDurationSeconds: 2,
        generic: true,
        baitAndSwitch: true,
      }),
    ).toEqual([
      "missing-evidence",
      "angle-promise-mismatch",
      "generic-hook",
      "bait-and-switch",
      "over-read-budget",
    ]);
  });
});

describe("viral templates", () => {
  it("adapts to five beats below 25 seconds", () => {
    expect(viralTemplatesForDuration(15).every((template) => template.beatCount === 5)).toBe(true);
  });

  it("uses seven beats from 25 through 60 seconds", () => {
    expect(viralTemplatesForDuration(45).every((template) => template.beatCount === 7)).toBe(true);
  });
});

describe("creative strategy validation", () => {
  it("accepts a complete selected strategy", () => {
    const result = validateCreativeStrategy(validManifest(), { requireSelection: true });
    expect(result.errors).toEqual([]);
    expect(result.manifest?.selection?.hookId).toBe("a1-h1");
  });

  it("rejects a hook selected from another angle", () => {
    const manifest = validManifest();
    const selection = manifest.selection;
    if (!selection) throw new Error("fixture selection missing");
    manifest.selection = { ...selection, hookId: "a2-h1" };
    const result = validateCreativeStrategy(manifest, { requireSelection: true });
    expect(result.errors).toContain("selected hook does not belong to selected angle.");
  });

  for (const language of ["vi", "en"]) {
    it(`keeps the ${language} fixture language with 5 angles and 15 hooks`, () => {
      if (language !== "vi" && language !== "en") throw new Error("unsupported fixture language");
      const manifest = shortSocial45SecondFixture(language);
      const result = validateCreativeStrategy(manifest, { requireSelection: true });
      expect(result.errors).toEqual([]);
      expect(result.manifest?.language).toBe(language);
      expect(result.manifest?.angles).toHaveLength(5);
      expect(result.manifest?.hooks).toHaveLength(15);
      expect(result.manifest?.selection?.hookId).toBe("a1-h1");
    });
  }

  it("rejects a seven-beat template for a 15-second strategy", () => {
    const manifest = validManifest(15);
    manifest.templates = viralTemplatesForDuration(30);
    const result = validateCreativeStrategy(manifest, { requireSelection: true });
    expect(result.errors).toContain("selected template must have 5 beats for 15s.");
  });
});
