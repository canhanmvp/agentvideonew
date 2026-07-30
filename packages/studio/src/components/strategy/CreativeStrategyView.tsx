import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, WarningCircle } from "@phosphor-icons/react";
import type {
  CreativeAngle,
  CreativeSelection,
  CreativeStrategyManifestV1,
  HookCandidate,
  ScoreBreakdown,
  StyleCandidate,
  ViralTemplate,
} from "@hyperframes/core/creative-strategy";
import { useCreativeStrategy } from "../../hooks/useCreativeStrategy";
import { useProjectSignaturePoll } from "../../hooks/useProjectSignaturePoll";
import { copyTextToClipboard } from "../../utils/clipboard";
import { Button } from "../ui/Button";

export interface CreativeStrategyViewProps {
  projectId: string;
}

function bestByScore<T extends { score: { total: number }; recommended?: boolean }>(
  items: T[],
): T | undefined {
  return [...items].sort((left, right) => {
    const recommendationDelta =
      Number(Boolean(right.recommended)) - Number(Boolean(left.recommended));
    return recommendationDelta || right.score.total - left.score.total;
  })[0];
}

function initialSelection(manifest: CreativeStrategyManifestV1): CreativeSelection | null {
  if (manifest.selection) return manifest.selection;
  const angle = bestByScore(manifest.angles.filter((candidate) => candidate.eligible));
  if (!angle) return null;
  const hook = bestByScore(
    manifest.hooks.filter((candidate) => candidate.eligible && candidate.angleId === angle.id),
  );
  const expectedBeatCount = manifest.durationSeconds < 25 ? 5 : 7;
  const template =
    manifest.templates.find(
      (candidate) => candidate.recommended && candidate.beatCount === expectedBeatCount,
    ) ?? manifest.templates.find((candidate) => candidate.beatCount === expectedBeatCount);
  const style = manifest.styles.find((candidate) => candidate.recommended) ?? manifest.styles[0];
  const audioMood = manifest.audioMoods.find((candidate) => candidate.id !== "custom")?.id;
  if (!hook || !template || !style || !audioMood) return null;
  return {
    angleId: angle.id,
    hookId: hook.id,
    templateId: template.id,
    styleId: style.id,
    audioMood,
    reason: "Recommended from the highest eligible creative-fit candidates.",
  };
}

function selectionKey(selection: CreativeSelection | null): string {
  return selection ? JSON.stringify(selection) : "";
}

function agentPrompt(path: string): string {
  return `Apply the selected short-social creative strategy in \`${path}\`.

First run:
\`npx hyperframes strategy check . --require-selection --json\`

Then:
1. Materialize the selected style tokens into \`frame.md\`.
2. Create or revise \`STORYBOARD.md\` using the selected angle, hook, template, style, and audio mood.
3. Record \`strategy\`, \`angle\`, \`hook\`, \`template\`, and \`style\` in storyboard frontmatter.
4. Give each scene one narrative job and one focal reveal; preserve the template energy curve, duration budget, transition role, and audio opportunities.
5. Run the short-social full-polish pass, then \`npx hyperframes lint\` and \`npx hyperframes check\`.

Do not change the selected strategy or invent unsupported claims.`;
}

export function CreativeStrategyView({ projectId }: CreativeStrategyViewProps) {
  const { data, loading, error, saving, saveError, reload, saveSelection } =
    useCreativeStrategy(projectId);
  const [selection, setSelection] = useState<CreativeSelection | null>(null);
  const [savedKey, setSavedKey] = useState("");
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [copied, setCopied] = useState(false);
  useProjectSignaturePoll(projectId, data?.signature, reload);

  useEffect(() => {
    if (!data?.manifest) return;
    const next = initialSelection(data.manifest);
    setSelection(next);
    setSavedKey(selectionKey(data.manifest.selection ?? null));
  }, [data?.manifest]);

  if (loading)
    return (
      <StrategyFrame>
        <Message>Loading creative strategy…</Message>
      </StrategyFrame>
    );
  if (error) {
    return (
      <StrategyFrame>
        <Message tone="error">Couldn’t load the creative strategy: {error}</Message>
        <div className="flex justify-center">
          <Button size="sm" variant="secondary" onClick={reload}>
            Retry
          </Button>
        </div>
      </StrategyFrame>
    );
  }
  if (!data) return <StrategyFrame>{null}</StrategyFrame>;
  if (!data.exists) {
    return (
      <StrategyFrame>
        <EmptyState path={data.path} />
      </StrategyFrame>
    );
  }
  if (!data.manifest) {
    return (
      <StrategyFrame>
        <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-5">
          <h2 className="text-sm font-semibold text-red-300">Creative strategy is invalid</h2>
          <ul className="mt-3 space-y-1 text-xs text-red-300/80">
            {data.errors.map((entry) => (
              <li key={entry}>• {entry}</li>
            ))}
          </ul>
        </div>
      </StrategyFrame>
    );
  }

  const manifest = data.manifest;
  const selectedAngle = manifest.angles.find((angle) => angle.id === selection?.angleId) ?? null;
  const visibleHooks = selectedAngle
    ? manifest.hooks.filter((hook) => hook.angleId === selectedAngle.id)
    : [];
  const expectedBeatCount = manifest.durationSeconds < 25 ? 5 : 7;
  const templateOptions = [
    ...manifest.templates.filter((template) => template.id === selection?.templateId),
    ...manifest.templates.filter(
      (template) =>
        template.id !== selection?.templateId && template.beatCount === expectedBeatCount,
    ),
  ].slice(0, 3);
  const rankedStyles = [
    ...manifest.styles.filter((style) => style.id === selection?.styleId),
    ...manifest.styles.filter((style) => style.id !== selection?.styleId),
  ];
  const styleOptions = showAllStyles ? rankedStyles : rankedStyles.slice(0, 3);
  const dirty = selectionKey(selection) !== savedKey;
  const complete =
    Boolean(
      selection &&
      selectedAngle?.eligible &&
      visibleHooks.some((hook) => hook.id === selection.hookId && hook.eligible) &&
      manifest.templates.some(
        (template) =>
          template.id === selection.templateId && template.beatCount === expectedBeatCount,
      ) &&
      manifest.styles.some((style) => style.id === selection.styleId),
    ) &&
    Boolean(selection && (selection.audioMood !== "custom" || selection.customAudioMood?.trim()));

  const chooseAngle = (angle: CreativeAngle) => {
    if (!selection || !angle.eligible) return;
    const nextHook = bestByScore(
      manifest.hooks.filter((hook) => hook.angleId === angle.id && hook.eligible),
    );
    if (!nextHook) return;
    setSelection({
      ...selection,
      angleId: angle.id,
      hookId: nextHook.id,
      reason: "Selected in HyperFrames Studio.",
    });
  };

  const handleSave = async () => {
    if (!selection || !complete) return;
    if (await saveSelection(selection)) {
      setSavedKey(selectionKey(selection));
      setCopied(false);
    }
  };

  const handleCopy = async () => {
    if (await copyTextToClipboard(agentPrompt(data.path))) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-neutral-950 text-neutral-200">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-neutral-100">Creative Strategy</h1>
            <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
              creative fit
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {manifest.durationSeconds}s · {manifest.language} · {manifest.audience}
          </p>
        </div>
        <div className="max-w-xl text-right">
          <p className="text-xs uppercase tracking-wide text-neutral-600">One message</p>
          <p className="mt-1 text-sm text-neutral-300">{manifest.message}</p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(250px,0.9fr)_minmax(300px,1.1fr)_minmax(330px,1fr)] overflow-hidden">
        <StrategyColumn title="Angles" subtitle="5 routes · evidence first">
          <div className="space-y-2">
            {manifest.angles.map((angle) => (
              <AngleCard
                key={angle.id}
                angle={angle}
                selected={selection?.angleId === angle.id}
                evidence={angle.evidenceIds.map(
                  (id) => manifest.evidence.find((item) => item.id === id)?.source ?? id,
                )}
                onSelect={() => chooseAngle(angle)}
              />
            ))}
          </div>
        </StrategyColumn>

        <StrategyColumn
          title="Hook test"
          subtitle={selectedAngle ? selectedAngle.title : "Select an eligible angle"}
          border
        >
          <div className="space-y-3">
            {visibleHooks.map((hook) => (
              <HookCard
                key={hook.id}
                hook={hook}
                selected={selection?.hookId === hook.id}
                onSelect={() => {
                  if (selection && hook.eligible) {
                    setSelection({
                      ...selection,
                      hookId: hook.id,
                      reason: "Selected in HyperFrames Studio.",
                    });
                  }
                }}
              />
            ))}
          </div>
        </StrategyColumn>

        <aside className="min-h-0 overflow-y-auto border-l border-neutral-800 px-4 py-4">
          <OptionSection title="Template" subtitle={`Top 3 · ${expectedBeatCount} beats`}>
            {templateOptions.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={selection?.templateId === template.id}
                onSelect={() => {
                  if (selection) {
                    setSelection({
                      ...selection,
                      templateId: template.id,
                      reason: "Selected in HyperFrames Studio.",
                    });
                  }
                }}
              />
            ))}
          </OptionSection>

          <OptionSection
            title="Style"
            subtitle={
              manifest.styles.length > 3
                ? `${showAllStyles ? "All" : "Top 3"} · ${manifest.styles.length} available`
                : `${manifest.styles.length} available`
            }
            action={
              manifest.styles.length > 3 ? (
                <button
                  type="button"
                  className="text-[11px] text-neutral-400 hover:text-neutral-200"
                  onClick={() => setShowAllStyles((value) => !value)}
                >
                  {showAllStyles ? "Show top 3" : "Show all"}
                </button>
              ) : null
            }
          >
            {styleOptions.map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                selected={selection?.styleId === style.id}
                onSelect={() => {
                  if (selection) {
                    setSelection({
                      ...selection,
                      styleId: style.id,
                      reason: "Selected in HyperFrames Studio.",
                    });
                  }
                }}
              />
            ))}
          </OptionSection>

          <OptionSection title="Audio mood" subtitle="BGM direction">
            <div className="grid grid-cols-2 gap-2">
              {manifest.audioMoods.map((mood) => (
                <button
                  key={mood.id}
                  type="button"
                  title={mood.description}
                  onClick={() => {
                    if (selection) {
                      setSelection({
                        ...selection,
                        audioMood: mood.id,
                        reason: "Selected in HyperFrames Studio.",
                      });
                    }
                  }}
                  className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-studio-accent ${
                    selection?.audioMood === mood.id
                      ? "border-studio-accent/70 bg-studio-accent/10 text-neutral-100"
                      : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700"
                  }`}
                >
                  {mood.name}
                </button>
              ))}
            </div>
            {selection?.audioMood === "custom" && (
              <input
                type="text"
                aria-label="Custom audio mood"
                value={selection.customAudioMood ?? ""}
                placeholder="Describe the music direction"
                onChange={(event) =>
                  setSelection({ ...selection, customAudioMood: event.currentTarget.value })
                }
                className="mt-2 w-full rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-studio-accent/60"
              />
            )}
          </OptionSection>
        </aside>
      </div>

      <footer className="flex min-h-14 items-center justify-between gap-4 border-t border-neutral-800 bg-neutral-900/70 px-5 py-2">
        <div className="min-w-0">
          {saveError ? (
            <p className="truncate text-xs text-red-400">{saveError}</p>
          ) : (
            <p className="text-xs text-neutral-500">
              {dirty
                ? "Unsaved selection"
                : manifest.selection
                  ? "Selection saved"
                  : "Review the recommendation"}
            </p>
          )}
          {data.warnings.length > 0 && (
            <p className="mt-0.5 truncate text-[11px] text-amber-400">
              {data.warnings.length} schema recommendation{data.warnings.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={dirty || !manifest.selection}
            onClick={handleCopy}
            icon={copied ? <Check size={14} /> : <Copy size={14} />}
          >
            {copied ? "Prompt copied" : "Copy prompt for agent"}
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={saving}
            disabled={!dirty || !complete || saving}
            onClick={() => void handleSave()}
          >
            Save selection
          </Button>
        </div>
      </footer>
    </div>
  );
}

function StrategyFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-neutral-950 px-8 py-8 text-neutral-200">
      <div className="mx-auto max-w-5xl">{children}</div>
    </div>
  );
}

function Message({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <div
      className={`px-6 py-12 text-center text-sm ${tone === "error" ? "text-red-400" : "text-neutral-500"}`}
    >
      {children}
    </div>
  );
}

function EmptyState({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const prompt = `Create \`${path}\` for an opt-in 9:16 short-social video (15–60 seconds).

Use sourced evidence, generate exactly 5 angles and 3 hooks per angle, score creative fit with the HyperFrames short-social rubric, adapt all 5 templates to the duration, and recommend template, style, and audio mood. Preserve the brief's language.`;
  return (
    <div className="rounded-lg border border-dashed border-neutral-800 px-6 py-10 text-center">
      <h2 className="text-base font-semibold text-neutral-300">No creative strategy yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm text-neutral-500">
        This is opt-in. Add <code className="rounded bg-neutral-900 px-1 py-0.5">{path}</code>{" "}
        through faceless-explainer, product-launch-video, or general-video with
        <code className="ml-1 rounded bg-neutral-900 px-1 py-0.5">
          format_profile: short-social
        </code>
        .
      </p>
      <Button
        size="sm"
        variant="secondary"
        className="mt-5"
        icon={copied ? <Check size={14} /> : <Copy size={14} />}
        onClick={() => {
          void copyTextToClipboard(prompt).then((ok) => {
            if (ok) setCopied(true);
          });
        }}
      >
        {copied ? "Prompt copied" : "Copy setup prompt"}
      </Button>
    </div>
  );
}

function StrategyColumn({
  title,
  subtitle,
  border = false,
  children,
}: {
  title: string;
  subtitle: string;
  border?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`min-h-0 overflow-y-auto px-4 py-4 ${border ? "border-l border-neutral-800" : ""}`}
    >
      <div className="mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-300">{title}</h2>
        <p className="mt-0.5 text-[11px] text-neutral-600">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function ScorePill({ total }: { total: number }) {
  return (
    <span
      aria-label={`Creative fit ${total} out of 100`}
      className="rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-neutral-300"
    >
      {total}
    </span>
  );
}

function DimensionGrid<T extends string>({ score }: { score: ScoreBreakdown<T> }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-neutral-600">
      {Object.entries(score.dimensions).map(([key, value]) => (
        <span key={key} className="flex justify-between gap-2">
          <span>{key.replace(/[A-Z]/g, (match) => ` ${match.toLowerCase()}`)}</span>
          <span className="tabular-nums text-neutral-500">{String(value)}/5</span>
        </span>
      ))}
    </div>
  );
}

function AngleCard({
  angle,
  selected,
  evidence,
  onSelect,
}: {
  angle: CreativeAngle;
  selected: boolean;
  evidence: string[];
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!angle.eligible}
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-studio-accent ${
        selected
          ? "border-studio-accent/70 bg-studio-accent/[0.07]"
          : "border-neutral-800 bg-neutral-900/35 hover:border-neutral-700"
      } ${angle.eligible ? "" : "cursor-not-allowed opacity-50"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-neutral-600">
            {angle.type.replaceAll("-", " ")}
          </div>
          <h3 className="mt-1 text-sm font-medium text-neutral-200">{angle.title}</h3>
        </div>
        <ScorePill total={angle.score.total} />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-neutral-400">{angle.insight}</p>
      <p className="mt-2 text-[11px] text-neutral-500">Evidence: {evidence.join(", ") || "none"}</p>
      <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-500/80">
        <WarningCircle className="mt-0.5 shrink-0" size={12} />
        {angle.risk}
      </p>
      <DimensionGrid score={angle.score} />
    </button>
  );
}

function HookCard({
  hook,
  selected,
  onSelect,
}: {
  hook: HookCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!hook.eligible}
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-studio-accent ${
        selected
          ? "border-studio-accent/70 bg-studio-accent/[0.07]"
          : "border-neutral-800 bg-neutral-900/35 hover:border-neutral-700"
      } ${hook.eligible ? "" : "cursor-not-allowed opacity-50"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-neutral-600">
          {hook.pattern.replaceAll("-", " ")}
        </span>
        <ScorePill total={hook.score.total} />
      </div>
      <p className="mt-2 text-sm font-medium leading-snug text-neutral-100">“{hook.copy}”</p>
      <p className="mt-2 text-xs text-neutral-500">First visual: {hook.firstVisual}</p>
      <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-600">
        <span>{hook.estimatedReadSeconds.toFixed(1)}s read</span>
        <span>
          {hook.evidenceIds.length} evidence link{hook.evidenceIds.length === 1 ? "" : "s"}
        </span>
      </div>
      {hook.disqualifiers.length > 0 && (
        <p className="mt-2 text-[10px] text-red-400">{hook.disqualifiers.join(" · ")}</p>
      )}
      <DimensionGrid score={hook.score} />
    </button>
  );
}

function OptionSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
            {title}
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-600">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function TemplateCard({
  template,
  selected,
  onSelect,
}: {
  template: ViralTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-studio-accent ${
        selected
          ? "border-studio-accent/70 bg-studio-accent/[0.07]"
          : "border-neutral-800 bg-neutral-900/35 hover:border-neutral-700"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-neutral-200">{template.name}</span>
        <span className="text-[10px] text-neutral-600">{template.beatCount} beats</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">{template.summary}</p>
      <div className="mt-2 flex h-1.5 overflow-hidden rounded-sm bg-neutral-800">
        {template.beats.map((beat) => (
          <span
            key={beat.role}
            title={`${beat.role}: ${Math.round(beat.durationShare * 100)}%`}
            style={{ width: `${beat.durationShare * 100}%`, opacity: 0.25 + beat.energy * 0.13 }}
            className="bg-studio-accent"
          />
        ))}
      </div>
    </button>
  );
}

function StyleCard({
  style,
  selected,
  onSelect,
}: {
  style: StyleCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-studio-accent ${
        selected
          ? "border-studio-accent/70 bg-studio-accent/[0.07]"
          : "border-neutral-800 bg-neutral-900/35 hover:border-neutral-700"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-neutral-200">{style.name}</span>
        <span className="flex items-center -space-x-1">
          {style.palette.slice(0, 5).map((color) => (
            <span
              key={color}
              className="h-4 w-4 rounded-full border border-neutral-700"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-neutral-500">{style.summary}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-neutral-600">
        <span>{style.typography}</span>
        <span>{style.density} density</span>
        <span>{style.texture}</span>
        <span>{style.motionIntensity} motion</span>
      </div>
      <p className="mt-2 text-[10px] text-neutral-500">Use when: {style.useWhen}</p>
    </button>
  );
}
