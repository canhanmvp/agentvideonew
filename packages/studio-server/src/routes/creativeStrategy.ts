import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import type { Hono } from "hono";
import {
  CREATIVE_STRATEGY_FILENAME,
  validateCreativeStrategy,
  type CreativeSelection,
  type CreativeStrategyManifestV1,
} from "@hyperframes/core/creative-strategy";
import { fileContentVersion } from "../helpers/fileVersion.js";
import { resolveProjectAndSignature } from "../helpers/projectSignature.js";
import { resolveWithinProject } from "../helpers/safePath.js";
import type { StudioApiAdapter } from "../types.js";

interface SelectionPatchBody {
  selection: CreativeSelection;
  expectedVersion: string;
}

let strategyWriteTail: Promise<unknown> = Promise.resolve();

function serializeStrategyWrite<T>(task: () => Promise<T>): Promise<T> {
  const next = strategyWriteTail.then(task, task);
  strategyWriteTail = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function isSelection(value: unknown): value is CreativeSelection {
  if (!isRecord(value)) return false;
  const record = value;
  return (
    typeof record.angleId === "string" &&
    typeof record.hookId === "string" &&
    typeof record.templateId === "string" &&
    typeof record.styleId === "string" &&
    typeof record.audioMood === "string" &&
    (record.customAudioMood === undefined || typeof record.customAudioMood === "string") &&
    (record.reason === undefined || typeof record.reason === "string")
  );
}

function isSelectionPatchBody(value: unknown): value is SelectionPatchBody {
  if (!isRecord(value)) return false;
  const record = value;
  return typeof record.expectedVersion === "string" && isSelection(record.selection);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function replaceFileAtomically(path: string, content: string): void {
  const tempPath = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(tempPath, content, "utf-8");
    renameSync(tempPath, path);
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath);
  }
}

export function registerCreativeStrategyRoutes(api: Hono, adapter: StudioApiAdapter): void {
  api.get("/projects/:id/creative-strategy", async (c) => {
    const resolved = await resolveProjectAndSignature(adapter, c.req.param("id"));
    if (!resolved) return c.json({ error: "not found" }, 404);
    const { project, signature } = resolved;
    const abs = resolveWithinProject(project.dir, CREATIVE_STRATEGY_FILENAME);
    if (!abs || !existsSync(abs)) {
      return c.json({
        exists: false,
        path: CREATIVE_STRATEGY_FILENAME,
        manifest: null,
        errors: [],
        warnings: [],
        version: null,
        signature,
      });
    }

    let source: string;
    try {
      source = readFileSync(abs, "utf-8");
    } catch {
      return c.json({ error: "failed to read creative strategy" }, 500);
    }

    const result = validateCreativeStrategy(source);
    const version = fileContentVersion(source);
    c.header("ETag", version);
    return c.json({
      exists: true,
      path: CREATIVE_STRATEGY_FILENAME,
      ...result,
      version,
      signature,
    });
  });

  api.patch("/projects/:id/creative-strategy/selection", async (c) => {
    const resolved = await resolveProjectAndSignature(adapter, c.req.param("id"));
    if (!resolved) return c.json({ error: "not found" }, 404);
    const abs = resolveWithinProject(resolved.project.dir, CREATIVE_STRATEGY_FILENAME);
    if (!abs || !existsSync(abs)) return c.json({ error: "creative strategy not found" }, 404);

    const body: unknown = await c.req.json().catch(() => null);
    if (!isSelectionPatchBody(body)) {
      return c.json({ error: "selection and expectedVersion are required" }, 400);
    }

    return serializeStrategyWrite(async () => {
      const currentSource = readFileSync(abs, "utf-8");
      const currentVersion = fileContentVersion(currentSource);
      if (body.expectedVersion !== currentVersion) {
        return c.json(
          {
            error: "creative strategy conflict",
            currentVersion,
          },
          409,
        );
      }

      const current = validateCreativeStrategy(currentSource);
      if (!current.manifest) {
        return c.json({ error: "creative strategy is invalid", details: current.errors }, 422);
      }
      const next: CreativeStrategyManifestV1 = {
        ...current.manifest,
        status: "selected",
        selection: body.selection,
      };
      const checked = validateCreativeStrategy(next, { requireSelection: true });
      if (!checked.manifest) {
        return c.json({ error: "selection is invalid", details: checked.errors }, 400);
      }

      const nextSource = `${JSON.stringify(checked.manifest, null, 2)}\n`;
      replaceFileAtomically(abs, nextSource);
      const nextVersion = fileContentVersion(nextSource);
      c.header("ETag", nextVersion);
      return c.json({
        ok: true,
        path: CREATIVE_STRATEGY_FILENAME,
        manifest: checked.manifest,
        warnings: checked.warnings,
        version: nextVersion,
      });
    });
  });
}
