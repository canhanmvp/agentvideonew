// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUDIO_MOODS,
  scoreAngle,
  scoreHook,
  viralTemplatesForDuration,
  type CreativeStrategyManifestV1,
} from "@hyperframes/core/creative-strategy";
import type { UseCreativeStrategyResult } from "../../hooks/useCreativeStrategy";
import { CreativeStrategyView } from "./CreativeStrategyView";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hookMock = vi.hoisted(() => ({
  result: null as UseCreativeStrategyResult | null,
}));

vi.mock("../../hooks/useCreativeStrategy", () => ({
  useCreativeStrategy: () => hookMock.result,
}));

vi.mock("../../hooks/useProjectSignaturePoll", () => ({
  useProjectSignaturePoll: () => undefined,
}));

function manifest(): CreativeStrategyManifestV1 {
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
    durationSeconds: 30,
    language: "vi",
    message: "Một video, một thông điệp",
    audience: "Creators",
    status: "proposed",
    evidence: [
      { id: "e1", claim: "Claim one", source: "Brief" },
      { id: "e2", claim: "Claim two", source: "Interview" },
    ],
    angles: [
      {
        id: "a1",
        type: "surprising-truth",
        title: "Angle one",
        insight: "First insight",
        promise: "First promise",
        evidenceIds: ["e1"],
        risk: "First risk",
        score: angleScore,
        eligible: true,
        disqualifiers: [],
        recommended: true,
      },
      {
        id: "a2",
        type: "hidden-cost",
        title: "Angle two",
        insight: "Second insight",
        promise: "Second promise",
        evidenceIds: ["e2"],
        risk: "Second risk",
        score: angleScore,
        eligible: true,
        disqualifiers: [],
      },
    ],
    hooks: [
      {
        id: "h1",
        angleId: "a1",
        pattern: "open-loop",
        copy: "Hook for angle one",
        firstVisual: "Visual one",
        evidenceIds: ["e1"],
        estimatedReadSeconds: 1,
        score: hookScore,
        eligible: true,
        disqualifiers: [],
      },
      {
        id: "h2",
        angleId: "a2",
        pattern: "concrete-stakes",
        copy: "Hook for angle two",
        firstVisual: "Visual two",
        evidenceIds: ["e2"],
        estimatedReadSeconds: 1,
        score: hookScore,
        eligible: true,
        disqualifiers: [],
      },
    ],
    templates: viralTemplatesForDuration(30),
    styles: [
      {
        id: "editorial",
        name: "Editorial",
        summary: "Clear",
        palette: ["#111111", "#ffffff"],
        typography: "Sans",
        density: "medium",
        texture: "grain",
        motionIntensity: "medium",
        useWhen: "Explainers",
        recommended: true,
      },
    ],
    audioMoods: AUDIO_MOODS,
  };
}

function result(overrides: Partial<UseCreativeStrategyResult> = {}): UseCreativeStrategyResult {
  return {
    data: {
      exists: true,
      path: ".hyperframes/creative-strategy.json",
      manifest: manifest(),
      errors: [],
      warnings: [],
      version: '"v1"',
      signature: "signature",
    },
    loading: false,
    error: null,
    saving: false,
    saveError: null,
    reload: vi.fn(),
    saveSelection: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function renderView(): { host: HTMLDivElement; root: Root } {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<CreativeStrategyView projectId="project" />));
  return { host, root };
}

function clickContaining(host: HTMLElement, text: string): void {
  const button = [...host.querySelectorAll("button")].find((entry) =>
    entry.textContent?.includes(text),
  );
  if (!button) throw new Error(`button not found: ${text}`);
  act(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

beforeEach(() => {
  hookMock.result = result();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

describe("CreativeStrategyView", () => {
  it("shows loading, absent, and error states", () => {
    hookMock.result = result({ loading: true, data: null });
    const loading = renderView();
    expect(loading.host.textContent).toContain("Loading creative strategy");
    act(() => loading.root.unmount());

    hookMock.result = result({
      data: {
        exists: false,
        path: ".hyperframes/creative-strategy.json",
        manifest: null,
        errors: [],
        warnings: [],
        version: null,
      },
    });
    const absent = renderView();
    expect(absent.host.textContent).toContain("No creative strategy yet");
    act(() => absent.root.unmount());

    hookMock.result = result({ data: null, error: "network down" });
    const failed = renderView();
    expect(failed.host.textContent).toContain("network down");
    act(() => failed.root.unmount());
  });

  it("shows creative-fit breakdown and filters hooks by the selected angle", () => {
    const { host, root } = renderView();
    expect(host.querySelector('[aria-label="Creative fit 80 out of 100"]')).toBeTruthy();
    expect(host.textContent).toContain("Hook for angle one");
    expect(host.textContent).not.toContain("Hook for angle two");

    clickContaining(host, "Angle two");
    expect(host.textContent).toContain("Hook for angle two");
    expect(host.textContent).not.toContain("Hook for angle one");
    act(() => root.unmount());
  });

  it("surfaces a stale-write conflict from the save hook", () => {
    hookMock.result = result({
      saveError: "Strategy changed on disk. Reloaded the latest version.",
    });
    const { host, root } = renderView();
    expect(host.textContent).toContain("Strategy changed on disk");
    act(() => root.unmount());
  });
});
