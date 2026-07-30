import type {
  AngleScoreDimensions,
  AngleType,
  AudioMood,
  AudioMoodCandidate,
  CreativeAngle,
  CreativeSelection,
  CreativeStrategyManifestV1,
  EvidenceClaim,
  HookCandidate,
  HookPattern,
  HookScoreDimensions,
  ScoreBreakdown,
  StrategyStatus,
  StrategyValidationResult,
  StyleCandidate,
  ViralTemplate,
  ViralTemplateBeat,
} from "./types.js";
import { CREATIVE_STRATEGY_VERSION, SHORT_SOCIAL_PROFILE } from "./types.js";
import { scoreAngle, scoreHook } from "./score.js";

const ANGLE_TYPES: readonly AngleType[] = [
  "surprising-truth",
  "hidden-cost",
  "transformation",
  "contrarian",
  "practical-mechanism",
];
const HOOK_PATTERNS: readonly HookPattern[] = [
  "open-loop",
  "concrete-stakes",
  "contrarian-interruption",
];
const AUDIO_MOODS: readonly AudioMood[] = [
  "ambient",
  "cinematic",
  "lo-fi",
  "piano",
  "dark",
  "custom",
];
const STRATEGY_STATUSES: readonly StrategyStatus[] = ["proposed", "selected"];
const TRANSITION_ROLES: readonly ViralTemplateBeat["transitionRole"][] = [
  "cut",
  "connective",
  "hero",
];
const AUDIO_OPPORTUNITIES: readonly NonNullable<ViralTemplateBeat["audioOpportunity"]>[] = [
  "none",
  "seam",
  "reveal",
  "impact",
];
const MOTION_INTENSITIES: readonly StyleCandidate["motionIntensity"][] = ["low", "medium", "high"];

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(record: JsonRecord, key: string): string | null {
  return typeof record[key] === "string" ? record[key] : null;
}

function numberValue(record: JsonRecord, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(record: JsonRecord, key: string): boolean {
  return record[key] === true;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) return null;
  return value;
}

function recordArray(value: unknown): JsonRecord[] | null {
  if (!Array.isArray(value) || value.some((entry) => !isRecord(entry))) return null;
  return value;
}

function enumValue<T extends string>(value: unknown, values: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  return values.find((candidate) => candidate === value) ?? null;
}

function scoreBreakdown(
  value: unknown,
  keys: readonly string[],
  path: string,
  errors: string[],
): ScoreBreakdown<string> | null {
  if (!isRecord(value) || !isRecord(value.dimensions)) {
    errors.push(`${path} must contain total and dimensions.`);
    return null;
  }
  const dimensions: Record<string, number> = {};
  for (const key of keys) {
    const dimension = value.dimensions[key];
    if (
      typeof dimension !== "number" ||
      !Number.isFinite(dimension) ||
      dimension < 0 ||
      dimension > 5
    ) {
      errors.push(`${path}.dimensions.${key} must be between 0 and 5.`);
      return null;
    }
    dimensions[key] = dimension;
  }
  const total = numberValue(value, "total");
  if (total === null || total < 0 || total > 100) {
    errors.push(`${path}.total must be between 0 and 100.`);
    return null;
  }
  return { total, dimensions };
}

function parseEvidence(value: unknown, errors: string[]): EvidenceClaim[] {
  const items = recordArray(value);
  if (!items) {
    errors.push("evidence must be an array.");
    return [];
  }
  return items.flatMap((item, index) => {
    const id = stringValue(item, "id");
    const claim = stringValue(item, "claim");
    const source = stringValue(item, "source");
    if (!id || !claim || !source) {
      errors.push(`evidence[${index}] requires id, claim, and source.`);
      return [];
    }
    const locator = stringValue(item, "locator") ?? undefined;
    return [{ id, claim, source, locator }];
  });
}

const ANGLE_SCORE_KEYS: readonly (keyof AngleScoreDimensions)[] = [
  "audienceFit",
  "proofStrength",
  "visualPotential",
  "novelty",
  "emotionalTension",
];

function parseAngles(value: unknown, errors: string[]): CreativeAngle[] {
  const items = recordArray(value);
  if (!items) {
    errors.push("angles must be an array.");
    return [];
  }
  return items.flatMap((item, index) => {
    const path = `angles[${index}]`;
    const id = stringValue(item, "id");
    const type = enumValue(item.type, ANGLE_TYPES);
    const title = stringValue(item, "title");
    const insight = stringValue(item, "insight");
    const promise = stringValue(item, "promise");
    const evidenceIds = stringArray(item.evidenceIds);
    const risk = stringValue(item, "risk");
    const disqualifiers = stringArray(item.disqualifiers);
    const rawScore = scoreBreakdown(item.score, ANGLE_SCORE_KEYS, `${path}.score`, errors);
    if (
      !id ||
      !type ||
      !title ||
      !insight ||
      !promise ||
      !evidenceIds ||
      !risk ||
      !disqualifiers ||
      !rawScore
    ) {
      errors.push(`${path} is incomplete.`);
      return [];
    }
    const score: ScoreBreakdown<keyof AngleScoreDimensions> = {
      total: rawScore.total,
      dimensions: {
        audienceFit: rawScore.dimensions.audienceFit ?? 0,
        proofStrength: rawScore.dimensions.proofStrength ?? 0,
        visualPotential: rawScore.dimensions.visualPotential ?? 0,
        novelty: rawScore.dimensions.novelty ?? 0,
        emotionalTension: rawScore.dimensions.emotionalTension ?? 0,
      },
    };
    const expectedTotal = scoreAngle(score.dimensions).total;
    if (score.total !== expectedTotal) {
      errors.push(`${path}.score.total must equal weighted creative fit ${expectedTotal}.`);
      return [];
    }
    return [
      {
        id,
        type,
        title,
        insight,
        promise,
        evidenceIds,
        risk,
        score,
        eligible: booleanValue(item, "eligible"),
        disqualifiers,
        recommended: booleanValue(item, "recommended") || undefined,
      },
    ];
  });
}

const HOOK_SCORE_KEYS: readonly (keyof HookScoreDimensions)[] = [
  "clarity",
  "curiosity",
  "specificity",
  "audienceFit",
  "credibility",
  "visualPotential",
];

function parseHooks(value: unknown, errors: string[]): HookCandidate[] {
  const items = recordArray(value);
  if (!items) {
    errors.push("hooks must be an array.");
    return [];
  }
  return items.flatMap((item, index) => {
    const path = `hooks[${index}]`;
    const id = stringValue(item, "id");
    const angleId = stringValue(item, "angleId");
    const pattern = enumValue(item.pattern, HOOK_PATTERNS);
    const copy = stringValue(item, "copy");
    const firstVisual = stringValue(item, "firstVisual");
    const evidenceIds = stringArray(item.evidenceIds);
    const estimatedReadSeconds = numberValue(item, "estimatedReadSeconds");
    const disqualifiers = stringArray(item.disqualifiers);
    const rawScore = scoreBreakdown(item.score, HOOK_SCORE_KEYS, `${path}.score`, errors);
    if (
      !id ||
      !angleId ||
      !pattern ||
      !copy ||
      !firstVisual ||
      !evidenceIds ||
      estimatedReadSeconds === null ||
      !disqualifiers ||
      !rawScore
    ) {
      errors.push(`${path} is incomplete.`);
      return [];
    }
    const score: ScoreBreakdown<keyof HookScoreDimensions> = {
      total: rawScore.total,
      dimensions: {
        clarity: rawScore.dimensions.clarity ?? 0,
        curiosity: rawScore.dimensions.curiosity ?? 0,
        specificity: rawScore.dimensions.specificity ?? 0,
        audienceFit: rawScore.dimensions.audienceFit ?? 0,
        credibility: rawScore.dimensions.credibility ?? 0,
        visualPotential: rawScore.dimensions.visualPotential ?? 0,
      },
    };
    const expectedTotal = scoreHook(score.dimensions).total;
    if (score.total !== expectedTotal) {
      errors.push(`${path}.score.total must equal weighted creative fit ${expectedTotal}.`);
      return [];
    }
    return [
      {
        id,
        angleId,
        pattern,
        copy,
        firstVisual,
        evidenceIds,
        estimatedReadSeconds,
        score,
        eligible: booleanValue(item, "eligible"),
        disqualifiers,
        recommended: booleanValue(item, "recommended") || undefined,
      },
    ];
  });
}

function parseBeat(value: JsonRecord, path: string, errors: string[]): ViralTemplateBeat | null {
  const role = stringValue(value, "role");
  const narrativeJob = stringValue(value, "narrativeJob");
  const durationShare = numberValue(value, "durationShare");
  const energy = numberValue(value, "energy");
  const transitionRole = enumValue(value.transitionRole, TRANSITION_ROLES);
  const audioOpportunity = enumValue(value.audioOpportunity, AUDIO_OPPORTUNITIES);
  if (
    !role ||
    !narrativeJob ||
    durationShare === null ||
    energy === null ||
    !transitionRole ||
    !audioOpportunity
  ) {
    errors.push(`${path} is incomplete.`);
    return null;
  }
  return { role, narrativeJob, durationShare, energy, transitionRole, audioOpportunity };
}

function parseTemplates(value: unknown, errors: string[]): ViralTemplate[] {
  const items = recordArray(value);
  if (!items) {
    errors.push("templates must be an array.");
    return [];
  }
  return items.flatMap((item, index) => {
    const path = `templates[${index}]`;
    const id = stringValue(item, "id");
    const name = stringValue(item, "name");
    const summary = stringValue(item, "summary");
    const beatCount = numberValue(item, "beatCount");
    const rawBeats = recordArray(item.beats);
    if (!id || !name || !summary || (beatCount !== 5 && beatCount !== 7) || !rawBeats) {
      errors.push(`${path} is incomplete.`);
      return [];
    }
    const beats = rawBeats.flatMap((rawBeat, beatIndex) => {
      const parsed = parseBeat(rawBeat, `${path}.beats[${beatIndex}]`, errors);
      return parsed ? [parsed] : [];
    });
    return [
      {
        id,
        name,
        summary,
        beatCount,
        beats,
        recommended: booleanValue(item, "recommended") || undefined,
      },
    ];
  });
}

function parseStyles(value: unknown, errors: string[]): StyleCandidate[] {
  const items = recordArray(value);
  if (!items) {
    errors.push("styles must be an array.");
    return [];
  }
  return items.flatMap((item, index) => {
    const id = stringValue(item, "id");
    const name = stringValue(item, "name");
    const summary = stringValue(item, "summary");
    const palette = stringArray(item.palette);
    const typography = stringValue(item, "typography");
    const density = stringValue(item, "density");
    const texture = stringValue(item, "texture");
    const motionIntensity = enumValue(item.motionIntensity, MOTION_INTENSITIES);
    const useWhen = stringValue(item, "useWhen");
    if (
      !id ||
      !name ||
      !summary ||
      !palette ||
      !typography ||
      !density ||
      !texture ||
      !motionIntensity ||
      !useWhen
    ) {
      errors.push(`styles[${index}] is incomplete.`);
      return [];
    }
    return [
      {
        id,
        name,
        summary,
        palette,
        typography,
        density,
        texture,
        motionIntensity,
        useWhen,
        recommended: booleanValue(item, "recommended") || undefined,
      },
    ];
  });
}

function parseAudioMoods(value: unknown, errors: string[]): AudioMoodCandidate[] {
  const items = recordArray(value);
  if (!items) {
    errors.push("audioMoods must be an array.");
    return [];
  }
  return items.flatMap((item, index) => {
    const id = enumValue(item.id, AUDIO_MOODS);
    const name = stringValue(item, "name");
    const description = stringValue(item, "description");
    const query = stringValue(item, "query");
    if (!id || !name || !description || query === null) {
      errors.push(`audioMoods[${index}] is incomplete.`);
      return [];
    }
    return [{ id, name, description, query }];
  });
}

function parseSelection(value: unknown, errors: string[]): CreativeSelection | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    errors.push("selection must be an object.");
    return undefined;
  }
  const angleId = stringValue(value, "angleId");
  const hookId = stringValue(value, "hookId");
  const templateId = stringValue(value, "templateId");
  const styleId = stringValue(value, "styleId");
  const audioMood = enumValue(value.audioMood, AUDIO_MOODS);
  if (!angleId || !hookId || !templateId || !styleId || !audioMood) {
    errors.push("selection requires angleId, hookId, templateId, styleId, and audioMood.");
    return undefined;
  }
  const customAudioMood = stringValue(value, "customAudioMood") ?? undefined;
  const reason = stringValue(value, "reason") ?? undefined;
  return { angleId, hookId, templateId, styleId, audioMood, customAudioMood, reason };
}

function duplicateIds<T extends { id: string }>(items: T[], label: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) errors.push(`${label} contains duplicate id "${item.id}".`);
    seen.add(item.id);
  }
}

function validateSelection(
  manifest: CreativeStrategyManifestV1,
  requireSelection: boolean,
  errors: string[],
): void {
  if (!manifest.selection) {
    if (requireSelection || manifest.status === "selected")
      errors.push("strategy selection is required.");
    return;
  }
  const angle = manifest.angles.find((candidate) => candidate.id === manifest.selection?.angleId);
  const hook = manifest.hooks.find((candidate) => candidate.id === manifest.selection?.hookId);
  const template = manifest.templates.find(
    (candidate) => candidate.id === manifest.selection?.templateId,
  );
  const style = manifest.styles.find((candidate) => candidate.id === manifest.selection?.styleId);
  if (!angle) errors.push(`selected angle "${manifest.selection.angleId}" does not exist.`);
  if (!hook) errors.push(`selected hook "${manifest.selection.hookId}" does not exist.`);
  if (hook && angle && hook.angleId !== angle.id)
    errors.push("selected hook does not belong to selected angle.");
  if (angle && !angle.eligible) errors.push("selected angle is not eligible.");
  if (hook && !hook.eligible) errors.push("selected hook is not eligible.");
  if (!template)
    errors.push(`selected template "${manifest.selection.templateId}" does not exist.`);
  if (!style) errors.push(`selected style "${manifest.selection.styleId}" does not exist.`);
  const expectedBeatCount = manifest.durationSeconds < 25 ? 5 : 7;
  if (template && template.beatCount !== expectedBeatCount) {
    errors.push(
      `selected template must have ${expectedBeatCount} beats for ${manifest.durationSeconds}s.`,
    );
  }
  if (manifest.selection.audioMood === "custom" && !manifest.selection.customAudioMood?.trim()) {
    errors.push("customAudioMood is required when audioMood is custom.");
  }
}

export function validateCreativeStrategy(
  source: string | unknown,
  options: { requireSelection?: boolean } = {},
): StrategyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let parsed: unknown = source;
  if (typeof source === "string") {
    try {
      parsed = JSON.parse(source);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid JSON";
      return {
        manifest: null,
        errors: [`creative strategy JSON is invalid: ${message}`],
        warnings,
      };
    }
  }
  if (!isRecord(parsed))
    return { manifest: null, errors: ["creative strategy must be an object."], warnings };

  const durationSeconds = numberValue(parsed, "durationSeconds");
  const language = stringValue(parsed, "language");
  const message = stringValue(parsed, "message");
  const audience = stringValue(parsed, "audience");
  const status = enumValue(parsed.status, STRATEGY_STATUSES);
  if (parsed.version !== CREATIVE_STRATEGY_VERSION) errors.push("version must be 1.");
  if (parsed.profile !== SHORT_SOCIAL_PROFILE) errors.push('profile must be "short-social".');
  if (durationSeconds === null || durationSeconds < 15 || durationSeconds > 60) {
    errors.push("durationSeconds must be between 15 and 60.");
  }
  if (!language) errors.push("language is required.");
  if (!message) errors.push("message is required.");
  if (!audience) errors.push("audience is required.");
  if (!status) errors.push('status must be "proposed" or "selected".');

  const evidence = parseEvidence(parsed.evidence, errors);
  const angles = parseAngles(parsed.angles, errors);
  const hooks = parseHooks(parsed.hooks, errors);
  const templates = parseTemplates(parsed.templates, errors);
  const styles = parseStyles(parsed.styles, errors);
  const audioMoods = parseAudioMoods(parsed.audioMoods, errors);
  const selection = parseSelection(parsed.selection, errors);
  duplicateIds(evidence, "evidence", errors);
  duplicateIds(angles, "angles", errors);
  duplicateIds(hooks, "hooks", errors);
  duplicateIds(templates, "templates", errors);
  duplicateIds(styles, "styles", errors);

  if (angles.length !== 5)
    warnings.push(`short-social strategy should contain 5 angles; found ${angles.length}.`);
  for (const angle of angles) {
    const count = hooks.filter((hook) => hook.angleId === angle.id).length;
    if (count !== 3) warnings.push(`angle "${angle.id}" should contain 3 hooks; found ${count}.`);
  }
  const evidenceIds = new Set(evidence.map((item) => item.id));
  for (const angle of angles) {
    if (angle.evidenceIds.length === 0) {
      errors.push(`angle "${angle.id}" must cite evidence.`);
    }
    if (angle.eligible && angle.disqualifiers.length > 0) {
      errors.push(`eligible angle "${angle.id}" cannot have disqualifiers.`);
    }
    if (angle.evidenceIds.some((id) => !evidenceIds.has(id))) {
      errors.push(`angle "${angle.id}" references unknown evidence.`);
    }
  }
  for (const hook of hooks) {
    const angle = angles.find((candidate) => candidate.id === hook.angleId);
    if (!angle) {
      errors.push(`hook "${hook.id}" references unknown angle "${hook.angleId}".`);
    }
    if (hook.evidenceIds.length === 0) {
      errors.push(`hook "${hook.id}" must cite evidence.`);
    }
    if (angle && !hook.evidenceIds.some((id) => angle.evidenceIds.includes(id))) {
      errors.push(`hook "${hook.id}" does not support its angle promise.`);
    }
    if (hook.eligible && hook.disqualifiers.length > 0) {
      errors.push(`eligible hook "${hook.id}" cannot have disqualifiers.`);
    }
    if (hook.evidenceIds.some((id) => !evidenceIds.has(id))) {
      errors.push(`hook "${hook.id}" references unknown evidence.`);
    }
  }
  for (const template of templates) {
    if (template.beats.length !== template.beatCount) {
      errors.push(`template "${template.id}" beatCount does not match its beats.`);
    }
    const durationShare = template.beats.reduce((sum, entry) => sum + entry.durationShare, 0);
    if (Math.abs(durationShare - 1) > 0.01) {
      errors.push(`template "${template.id}" duration shares must total 1.`);
    }
  }

  if (
    errors.length > 0 ||
    durationSeconds === null ||
    !language ||
    !message ||
    !audience ||
    !status
  ) {
    return { manifest: null, errors, warnings };
  }

  const manifest: CreativeStrategyManifestV1 = {
    version: CREATIVE_STRATEGY_VERSION,
    profile: SHORT_SOCIAL_PROFILE,
    durationSeconds,
    language,
    message,
    audience,
    status,
    evidence,
    angles,
    hooks,
    templates,
    styles,
    audioMoods,
    selection,
  };
  validateSelection(manifest, options.requireSelection ?? false, errors);
  return { manifest: errors.length === 0 ? manifest : null, errors, warnings };
}
