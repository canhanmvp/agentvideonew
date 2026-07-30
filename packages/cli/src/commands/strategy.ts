import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  CREATIVE_STRATEGY_FILENAME,
  validateCreativeStrategy,
  type StrategyValidationResult,
} from "@hyperframes/core/creative-strategy";
import { parseStoryboard, STORYBOARD_FILENAME } from "@hyperframes/core/storyboard";
import { defineCommand } from "citty";
import type { Example } from "./_examples.js";
import { c } from "../ui/colors.js";
import { setCommandExitCode } from "../utils/commandResult.js";
import { withMeta } from "../utils/updateCheck.js";

export const examples: Example[] = [
  ["Check the selected short-social strategy", "hyperframes strategy check"],
  [
    "Gate storyboard creation on a complete selection",
    "hyperframes strategy check ./my-video --require-selection --json",
  ],
];

export interface StrategyCheckResult extends StrategyValidationResult {
  ok: boolean;
  exists: boolean;
  path: string;
  storyboardExists: boolean;
}

function storyboardTraceErrors(
  projectDir: string,
  result: StrategyValidationResult,
): { exists: boolean; errors: string[] } {
  const path = join(projectDir, STORYBOARD_FILENAME);
  if (!existsSync(path)) return { exists: false, errors: [] };
  if (!result.manifest?.selection) return { exists: true, errors: [] };
  const storyboard = parseStoryboard(readFileSync(path, "utf-8"));
  const extra = storyboard.globals.extra;
  const expected: Record<string, string> = {
    strategy: CREATIVE_STRATEGY_FILENAME,
    angle: result.manifest.selection.angleId,
    hook: result.manifest.selection.hookId,
    template: result.manifest.selection.templateId,
    style: result.manifest.selection.styleId,
  };
  const errors: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    if (extra[key] !== value) errors.push(`STORYBOARD.md ${key} must be "${value}".`);
  }
  return { exists: true, errors };
}

export function checkStrategy(projectDir: string, requireSelection: boolean): StrategyCheckResult {
  const projectRoot = resolve(projectDir);
  const path = join(projectRoot, CREATIVE_STRATEGY_FILENAME);
  if (!existsSync(path)) {
    return {
      ok: false,
      exists: false,
      path,
      storyboardExists: false,
      manifest: null,
      errors: [`${CREATIVE_STRATEGY_FILENAME} does not exist.`],
      warnings: [],
    };
  }
  const result = validateCreativeStrategy(readFileSync(path, "utf-8"), { requireSelection });
  const trace = storyboardTraceErrors(projectRoot, result);
  const errors = [...result.errors, ...trace.errors];
  return {
    ...result,
    errors,
    ok: errors.length === 0,
    exists: true,
    path,
    storyboardExists: trace.exists,
  };
}

const checkCommand = defineCommand({
  meta: {
    name: "check",
    description:
      "Validate creative-strategy.json and its selected angle, hook, template, and style",
  },
  args: {
    dir: {
      type: "positional",
      description: "Project directory",
      required: false,
    },
    json: {
      type: "boolean",
      description: "Output result as JSON",
      default: false,
    },
    "require-selection": {
      type: "boolean",
      description: "Fail unless a complete, consistent selection exists",
      default: false,
    },
  },
  run({ args }) {
    const result = checkStrategy(
      typeof args.dir === "string" ? args.dir : ".",
      args["require-selection"] === true,
    );
    if (args.json) {
      console.log(JSON.stringify(withMeta(result), null, 2));
    } else if (result.ok) {
      const scoreLabel = result.manifest?.selection ? "selection complete" : "proposal valid";
      console.log(`${c.success("◇")} Creative strategy valid — ${scoreLabel}`);
      for (const warning of result.warnings) console.log(c.warn(`! ${warning}`));
    } else {
      console.error(c.error("Creative strategy check failed"));
      for (const error of result.errors) console.error(c.error(`- ${error}`));
    }
    setCommandExitCode(result.ok ? 0 : 1);
  },
});

export default defineCommand({
  meta: {
    name: "strategy",
    description: "Validate short-social creative strategy before storyboard generation",
  },
  subCommands: {
    check: checkCommand,
  },
});
