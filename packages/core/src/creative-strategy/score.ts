import type { AngleScoreDimensions, HookScoreDimensions, ScoreBreakdown } from "./types.js";

function clampDimension(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(5, value));
}

export function scoreAngle(
  dimensions: AngleScoreDimensions,
): ScoreBreakdown<keyof AngleScoreDimensions> {
  const normalized: Record<keyof AngleScoreDimensions, number> = {
    audienceFit: clampDimension(dimensions.audienceFit),
    proofStrength: clampDimension(dimensions.proofStrength),
    visualPotential: clampDimension(dimensions.visualPotential),
    novelty: clampDimension(dimensions.novelty),
    emotionalTension: clampDimension(dimensions.emotionalTension),
  };
  const total = Math.round(
    (normalized.audienceFit / 5) * 25 +
      (normalized.proofStrength / 5) * 25 +
      (normalized.visualPotential / 5) * 20 +
      (normalized.novelty / 5) * 15 +
      (normalized.emotionalTension / 5) * 15,
  );
  return { dimensions: normalized, total };
}

export function scoreHook(
  dimensions: HookScoreDimensions,
): ScoreBreakdown<keyof HookScoreDimensions> {
  const normalized: Record<keyof HookScoreDimensions, number> = {
    clarity: clampDimension(dimensions.clarity),
    curiosity: clampDimension(dimensions.curiosity),
    specificity: clampDimension(dimensions.specificity),
    audienceFit: clampDimension(dimensions.audienceFit),
    credibility: clampDimension(dimensions.credibility),
    visualPotential: clampDimension(dimensions.visualPotential),
  };
  const total = Math.round(
    (normalized.clarity / 5) * 20 +
      (normalized.curiosity / 5) * 20 +
      (normalized.specificity / 5) * 15 +
      (normalized.audienceFit / 5) * 15 +
      (normalized.credibility / 5) * 15 +
      (normalized.visualPotential / 5) * 15,
  );
  return { dimensions: normalized, total };
}

export interface HookEligibilityInput {
  evidenceIds: string[];
  knownEvidenceIds: Set<string>;
  angleEvidenceIds: string[];
  estimatedReadSeconds: number;
  hookDurationSeconds: number;
  generic?: boolean;
  baitAndSwitch?: boolean;
}

export function hookDisqualifiers(input: HookEligibilityInput): string[] {
  const reasons: string[] = [];
  const validEvidence = input.evidenceIds.filter((id) => input.knownEvidenceIds.has(id));
  if (validEvidence.length === 0) reasons.push("missing-evidence");
  if (!validEvidence.some((id) => input.angleEvidenceIds.includes(id))) {
    reasons.push("angle-promise-mismatch");
  }
  if (input.generic) reasons.push("generic-hook");
  if (input.baitAndSwitch) reasons.push("bait-and-switch");
  if (input.estimatedReadSeconds > Math.max(0.5, input.hookDurationSeconds - 0.3)) {
    reasons.push("over-read-budget");
  }
  return reasons;
}
