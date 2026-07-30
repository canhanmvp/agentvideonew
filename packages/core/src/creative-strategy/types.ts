export const CREATIVE_STRATEGY_FILENAME = ".hyperframes/creative-strategy.json";
export const CREATIVE_STRATEGY_VERSION = 1 as const;
export const SHORT_SOCIAL_PROFILE = "short-social" as const;

export type AngleType =
  | "surprising-truth"
  | "hidden-cost"
  | "transformation"
  | "contrarian"
  | "practical-mechanism";

export type HookPattern = "open-loop" | "concrete-stakes" | "contrarian-interruption";

export type AudioMood = "ambient" | "cinematic" | "lo-fi" | "piano" | "dark" | "custom";

export type StrategyStatus = "proposed" | "selected";

export interface ScoreBreakdown<T extends string = string> {
  /** Weighted creative-fit score. This is not a retention prediction. */
  total: number;
  dimensions: Record<T, number>;
}

export interface EvidenceClaim {
  id: string;
  claim: string;
  source: string;
  locator?: string;
}

export interface AngleScoreDimensions {
  audienceFit: number;
  proofStrength: number;
  visualPotential: number;
  novelty: number;
  emotionalTension: number;
}

export interface HookScoreDimensions {
  clarity: number;
  curiosity: number;
  specificity: number;
  audienceFit: number;
  credibility: number;
  visualPotential: number;
}

export interface CreativeAngle {
  id: string;
  type: AngleType;
  title: string;
  insight: string;
  promise: string;
  evidenceIds: string[];
  risk: string;
  score: ScoreBreakdown<keyof AngleScoreDimensions>;
  eligible: boolean;
  disqualifiers: string[];
  recommended?: boolean;
}

export interface HookCandidate {
  id: string;
  angleId: string;
  pattern: HookPattern;
  copy: string;
  firstVisual: string;
  evidenceIds: string[];
  estimatedReadSeconds: number;
  score: ScoreBreakdown<keyof HookScoreDimensions>;
  eligible: boolean;
  disqualifiers: string[];
  recommended?: boolean;
}

export interface ViralTemplateBeat {
  role: string;
  narrativeJob: string;
  durationShare: number;
  energy: number;
  transitionRole: "cut" | "connective" | "hero";
  audioOpportunity?: "none" | "seam" | "reveal" | "impact";
}

export interface ViralTemplate {
  id: string;
  name: string;
  summary: string;
  beatCount: 5 | 7;
  beats: ViralTemplateBeat[];
  recommended?: boolean;
}

export interface StyleCandidate {
  id: string;
  name: string;
  summary: string;
  palette: string[];
  typography: string;
  density: string;
  texture: string;
  motionIntensity: "low" | "medium" | "high";
  useWhen: string;
  recommended?: boolean;
}

export interface AudioMoodCandidate {
  id: AudioMood;
  name: string;
  description: string;
  query: string;
}

export interface CreativeSelection {
  angleId: string;
  hookId: string;
  templateId: string;
  styleId: string;
  audioMood: AudioMood;
  customAudioMood?: string;
  /** Human-readable selection rationale; autonomous runs must populate it. */
  reason?: string;
}

export interface CreativeStrategyManifestV1 {
  version: typeof CREATIVE_STRATEGY_VERSION;
  profile: typeof SHORT_SOCIAL_PROFILE;
  durationSeconds: number;
  language: string;
  message: string;
  audience: string;
  status: StrategyStatus;
  evidence: EvidenceClaim[];
  angles: CreativeAngle[];
  hooks: HookCandidate[];
  templates: ViralTemplate[];
  styles: StyleCandidate[];
  audioMoods: AudioMoodCandidate[];
  selection?: CreativeSelection;
}

export interface StrategyValidationResult {
  manifest: CreativeStrategyManifestV1 | null;
  errors: string[];
  warnings: string[];
}
