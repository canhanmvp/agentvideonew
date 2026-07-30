import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AUDIO_MOODS,
  scoreAngle,
  scoreHook,
  viralTemplatesForDuration,
  type CreativeStrategyManifestV1,
} from "@hyperframes/core/creative-strategy";
import { checkStrategy } from "./strategy.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function projectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "strategy-cli-"));
  tempDirs.push(dir);
  return dir;
}

function validProposal(): CreativeStrategyManifestV1 {
  const angleScore = scoreAngle({
    audienceFit: 4,
    proofStrength: 4,
    visualPotential: 4,
    novelty: 4,
    emotionalTension: 4,
  });
  const hookScore = scoreHook({
    clarity: 4,
    curiosity: 4,
    specificity: 4,
    audienceFit: 4,
    credibility: 4,
    visualPotential: 4,
  });
  return {
    version: 1,
    profile: "short-social",
    durationSeconds: 45,
    language: "en",
    message: "One message",
    audience: "Creators",
    status: "proposed",
    evidence: [{ id: "e1", claim: "Claim", source: "Brief" }],
    angles: [
      {
        id: "a1",
        type: "practical-mechanism",
        title: "Mechanism",
        insight: "Insight",
        promise: "Promise",
        evidenceIds: ["e1"],
        risk: "Needs context",
        score: angleScore,
        eligible: true,
        disqualifiers: [],
      },
    ],
    hooks: [
      {
        id: "h1",
        angleId: "a1",
        pattern: "concrete-stakes",
        copy: "Here is what changes.",
        firstVisual: "Before and after",
        evidenceIds: ["e1"],
        estimatedReadSeconds: 1,
        score: hookScore,
        eligible: true,
        disqualifiers: [],
      },
    ],
    templates: viralTemplatesForDuration(45),
    styles: [
      {
        id: "clean",
        name: "Clean",
        summary: "Clear",
        palette: ["#000000", "#ffffff"],
        typography: "Sans",
        density: "low",
        texture: "none",
        motionIntensity: "medium",
        useWhen: "Mechanism",
      },
    ],
    audioMoods: AUDIO_MOODS,
  };
}

function writeStrategy(dir: string, manifest: CreativeStrategyManifestV1): void {
  mkdirSync(join(dir, ".hyperframes"), { recursive: true });
  writeFileSync(join(dir, ".hyperframes", "creative-strategy.json"), JSON.stringify(manifest));
}

describe("strategy check", () => {
  it("fails clearly when the strategy is absent", () => {
    expect(checkStrategy(projectDir(), false)).toMatchObject({ ok: false, exists: false });
  });

  it("accepts a valid proposal unless selection is required", () => {
    const dir = projectDir();
    writeStrategy(dir, validProposal());
    expect(checkStrategy(dir, false).ok).toBe(true);
    expect(checkStrategy(dir, true).errors).toContain("strategy selection is required.");
  });

  it("accepts a complete consistent selection", () => {
    const dir = projectDir();
    const proposal = validProposal();
    const selected: CreativeStrategyManifestV1 = {
      ...proposal,
      status: "selected",
      selection: {
        angleId: "a1",
        hookId: "h1",
        templateId: "insight-loop",
        styleId: "clean",
        audioMood: "ambient",
      },
    };
    writeStrategy(dir, selected);
    expect(checkStrategy(dir, true).ok).toBe(true);
  });

  it("checks storyboard traceability once STORYBOARD.md exists", () => {
    const dir = projectDir();
    const proposal = validProposal();
    const selected: CreativeStrategyManifestV1 = {
      ...proposal,
      status: "selected",
      selection: {
        angleId: "a1",
        hookId: "h1",
        templateId: "insight-loop",
        styleId: "clean",
        audioMood: "ambient",
      },
    };
    writeStrategy(dir, selected);
    writeFileSync(
      join(dir, "STORYBOARD.md"),
      `---
strategy: .hyperframes/creative-strategy.json
angle: a1
hook: wrong-hook
template: insight-loop
style: clean
---
`,
    );
    const result = checkStrategy(dir, true);
    expect(result.storyboardExists).toBe(true);
    expect(result.errors).toContain('STORYBOARD.md hook must be "h1".');
  });
});
