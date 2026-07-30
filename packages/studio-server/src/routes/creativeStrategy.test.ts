import { afterEach, describe, expect, it } from "vitest";
import { Hono } from "hono";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AUDIO_MOODS,
  scoreAngle,
  scoreHook,
  viralTemplatesForDuration,
  type CreativeSelection,
  type CreativeStrategyManifestV1,
} from "@hyperframes/core/creative-strategy";
import { fileContentVersion } from "../helpers/fileVersion.js";
import type { StudioApiAdapter } from "../types.js";
import { registerCreativeStrategyRoutes } from "./creativeStrategy.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "creative-strategy-route-"));
  tempDirs.push(dir);
  return dir;
}

function makeApp(projectDir: string): Hono {
  const adapter: StudioApiAdapter = {
    resolveProject: (id: string) => (id === "p" ? { id: "p", dir: projectDir } : null),
    listProjects: () => [],
    bundle: () => null,
    lint: () => ({ findings: [] }),
    runtimeUrl: "",
    rendersDir: () => projectDir,
    startRender: () => {
      throw new Error("not used");
    },
  };
  const app = new Hono();
  registerCreativeStrategyRoutes(app, adapter);
  return app;
}

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
    message: "Một thông điệp.",
    audience: "Creator",
    status: "proposed",
    evidence: [{ id: "e1", claim: "Claim", source: "Brief" }],
    angles: [
      {
        id: "a1",
        type: "surprising-truth",
        title: "Sự thật bất ngờ",
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
        pattern: "open-loop",
        copy: "Bạn đang bỏ lỡ điều này.",
        firstVisual: "Counter reveal",
        evidenceIds: ["e1"],
        estimatedReadSeconds: 1.2,
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
        summary: "Clear and direct",
        palette: ["#111111", "#ffffff"],
        typography: "Sans",
        density: "medium",
        texture: "none",
        motionIntensity: "medium",
        useWhen: "Explaining an insight",
      },
    ],
    audioMoods: AUDIO_MOODS,
  };
}

function writeManifest(projectDir: string): string {
  mkdirSync(join(projectDir, ".hyperframes"), { recursive: true });
  const source = `${JSON.stringify(manifest(), null, 2)}\n`;
  writeFileSync(join(projectDir, ".hyperframes", "creative-strategy.json"), source);
  return source;
}

const selection: CreativeSelection = {
  angleId: "a1",
  hookId: "h1",
  templateId: "insight-loop",
  styleId: "editorial",
  audioMood: "cinematic",
};

describe("creative strategy routes", () => {
  it("returns an explicit absent state", async () => {
    const response = await makeApp(makeProject()).request("/projects/p/creative-strategy");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ exists: false, manifest: null, version: null });
  });

  it("loads and validates an existing strategy", async () => {
    const dir = makeProject();
    const source = writeManifest(dir);
    const response = await makeApp(dir).request("/projects/p/creative-strategy");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      exists: true,
      manifest: { profile: "short-social", language: "vi" },
      version: fileContentVersion(source),
    });
  });

  it("saves a consistent selection and rejects a stale successor", async () => {
    const dir = makeProject();
    const source = writeManifest(dir);
    const app = makeApp(dir);
    const patch = () =>
      app.request("/projects/p/creative-strategy/selection", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selection, expectedVersion: fileContentVersion(source) }),
      });
    const [first, second] = await Promise.all([patch(), patch()]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);

    const saved = JSON.parse(
      readFileSync(join(dir, ".hyperframes", "creative-strategy.json"), "utf-8"),
    );
    expect(saved).toMatchObject({ status: "selected", selection });
  });

  it("rejects a hook that is not in the selected angle", async () => {
    const dir = makeProject();
    const source = writeManifest(dir);
    const response = await makeApp(dir).request("/projects/p/creative-strategy/selection", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        selection: { ...selection, hookId: "missing-hook" },
        expectedVersion: fileContentVersion(source),
      }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "selection is invalid" });
  });
});
