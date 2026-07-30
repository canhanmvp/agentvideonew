import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CreativeSelection,
  CreativeStrategyManifestV1,
} from "@hyperframes/core/creative-strategy";
import { buildProjectApiPath } from "../utils/projectRouting";

export interface CreativeStrategyResponse {
  exists: boolean;
  path: string;
  manifest: CreativeStrategyManifestV1 | null;
  errors: string[];
  warnings: string[];
  version: string | null;
  signature?: string;
}

interface SelectionPatchResponse {
  manifest: CreativeStrategyManifestV1;
  warnings: string[];
  version: string;
}

export interface UseCreativeStrategyResult {
  data: CreativeStrategyResponse | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
  reload: () => void;
  saveSelection: (selection: CreativeSelection) => Promise<boolean>;
}

async function responseError(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const error = Reflect.get(payload, "error");
    const details = Reflect.get(payload, "details");
    if (typeof error === "string" && Array.isArray(details)) {
      return `${error}: ${details.filter((entry) => typeof entry === "string").join(" ")}`;
    }
    if (typeof error === "string") return error;
  }
  return `creative strategy request failed: ${response.status}`;
}

export function useCreativeStrategy(projectId: string | null): UseCreativeStrategyResult {
  const [data, setData] = useState<CreativeStrategyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const latestDataRef = useRef<CreativeStrategyResponse | null>(null);

  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(buildProjectApiPath(projectId, "/creative-strategy"))
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<CreativeStrategyResponse>;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "failed to load creative strategy");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  const saveSelection = useCallback(
    async (selection: CreativeSelection): Promise<boolean> => {
      const current = latestDataRef.current;
      if (!projectId || !current?.version) {
        setSaveError("Reload the strategy before saving.");
        return false;
      }
      setSaving(true);
      setSaveError(null);
      try {
        const response = await fetch(
          buildProjectApiPath(projectId, "/creative-strategy/selection"),
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ selection, expectedVersion: current.version }),
          },
        );
        if (!response.ok) {
          const message = await responseError(response);
          if (response.status === 409) {
            reload();
            throw new Error(
              "Strategy changed on disk. Reloaded the latest version; review and save again.",
            );
          }
          throw new Error(message);
        }
        const payload = (await response.json()) as SelectionPatchResponse;
        setData((previous) =>
          previous
            ? {
                ...previous,
                manifest: payload.manifest,
                warnings: payload.warnings,
                errors: [],
                version: payload.version,
              }
            : previous,
        );
        return true;
      } catch (reason) {
        setSaveError(reason instanceof Error ? reason.message : "failed to save strategy");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [projectId, reload],
  );

  return { data, loading, error, saving, saveError, reload, saveSelection };
}
