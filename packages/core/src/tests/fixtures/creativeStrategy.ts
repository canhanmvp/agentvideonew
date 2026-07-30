import {
  AUDIO_MOODS,
  scoreAngle,
  scoreHook,
  viralTemplatesForDuration,
  type AngleType,
  type CreativeStrategyManifestV1,
  type HookPattern,
  type StyleCandidate,
} from "../../creative-strategy/index.js";

const ANGLE_TYPES: AngleType[] = [
  "surprising-truth",
  "hidden-cost",
  "transformation",
  "contrarian",
  "practical-mechanism",
];
const HOOK_PATTERNS: HookPattern[] = ["open-loop", "concrete-stakes", "contrarian-interruption"];

const STYLES: StyleCandidate[] = [
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
  {
    id: "swiss-pulse",
    name: "Swiss Pulse",
    summary: "Precise grid-led information design.",
    palette: ["#ffffff", "#1a1a1a", "#0066ff"],
    typography: "neo-grotesk sans",
    density: "medium",
    texture: "registration marks",
    motionIntensity: "medium",
    useWhen: "The mechanism or proof must read instantly.",
    recommended: true,
  },
  {
    id: "soft-signal",
    name: "Soft Signal",
    summary: "Warm, human visual storytelling.",
    palette: ["#f8f4ec", "#2b2a28", "#ef8354"],
    typography: "humanist sans + serif",
    density: "low",
    texture: "paper grain",
    motionIntensity: "low",
    useWhen: "The transformation should feel personal.",
    recommended: true,
  },
];

export function shortSocial45SecondFixture(language: "vi" | "en"): CreativeStrategyManifestV1 {
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
  const vi = language === "vi";
  const evidence = [
    {
      id: "e1",
      claim: vi ? "Một tuyên bố có nguồn." : "A sourced claim.",
      source: "BRIEF.md",
    },
  ];
  const angles = ANGLE_TYPES.map((type, index) => ({
    id: `a${index + 1}`,
    type,
    title: vi ? `Góc nhìn ${index + 1}` : `Angle ${index + 1}`,
    insight: vi ? "Insight bám sát bằng chứng." : "An evidence-grounded insight.",
    promise: vi ? "Lời hứa có thể kiểm chứng." : "A verifiable promise.",
    evidenceIds: ["e1"],
    risk: vi ? "Cần đủ ngữ cảnh." : "Needs enough context.",
    score: angleScore,
    eligible: true,
    disqualifiers: [],
    recommended: index === 0,
  }));
  const hooks = angles.flatMap((angle) =>
    HOOK_PATTERNS.map((pattern, index) => ({
      id: `${angle.id}-h${index + 1}`,
      angleId: angle.id,
      pattern,
      copy: vi ? "Điều gì thay đổi khi bạn thấy điều này?" : "What changes when you see this?",
      firstVisual: vi ? "Một hình ảnh cụ thể." : "A concrete first visual.",
      evidenceIds: ["e1"],
      estimatedReadSeconds: 1.5,
      score: hookScore,
      eligible: true,
      disqualifiers: [],
      recommended: angle.id === "a1" && index === 0,
    })),
  );
  return {
    version: 1,
    profile: "short-social",
    durationSeconds: 45,
    language,
    message: vi ? "Một video, một thông điệp." : "One video, one message.",
    audience: vi ? "Nhà sáng tạo" : "Creators",
    status: "selected",
    evidence,
    angles,
    hooks,
    templates: viralTemplatesForDuration(45),
    styles: STYLES,
    audioMoods: AUDIO_MOODS,
    selection: {
      angleId: "a1",
      hookId: "a1-h1",
      templateId: "insight-loop",
      styleId: "shadow-cut",
      audioMood: "dark",
      reason: vi
        ? "Ứng viên hợp lệ có creative fit cao nhất."
        : "Highest eligible creative-fit candidate.",
    },
  };
}
