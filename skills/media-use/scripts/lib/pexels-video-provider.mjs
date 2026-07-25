import { loadProjectEnv } from "./project-env.mjs";

const PEXELS_VIDEO_SEARCH = "https://api.pexels.com/v1/videos/search";
const ORIENTATIONS = new Set(["landscape", "portrait", "square"]);
const SIZES = new Set(["large", "medium", "small"]);

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

const finiteOrNull = (value) => {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export function inferVideoOrientation(intent = "") {
  const text = String(intent).toLowerCase();
  if (
    /(9\s*:\s*16|vertical|portrait|tiktok|reels?|shorts?|video\s+d[oọ]c|khung\s+d[oọ]c)/i.test(
      text,
    )
  )
    return "portrait";
  if (/(1\s*:\s*1|square|video\s+vu[oô]ng|khung\s+vu[oô]ng)/i.test(text)) return "square";
  if (/(16\s*:\s*9|landscape|horizontal|video\s+ngang|khung\s+ngang)/i.test(text))
    return "landscape";
  return null;
}

export function inferDurationRange(intent = "") {
  const text = String(intent).toLowerCase();
  const range = text.match(
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|to|đ[eế]n)\s*(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?|gi[aâ]y)\b/i,
  );
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const exact = text.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|seconds?|gi[aâ]y)\b/i);
  if (exact) {
    const seconds = Number(exact[1]);
    return { min: Math.max(0, seconds - 2), max: seconds + 2 };
  }
  return { min: null, max: null };
}

function chooseVideoFile(video, size = "medium") {
  const files = (video?.video_files ?? []).filter(
    (file) =>
      file?.link &&
      (!file.file_type || file.file_type === "video/mp4") &&
      Number(file.width) > 0 &&
      Number(file.height) > 0,
  );
  if (!files.length) return null;

  const cap = size === "small" ? 1280 : size === "medium" ? 1920 : Number.POSITIVE_INFINITY;
  const ranked = files
    .map((file) => ({
      file,
      longEdge: Math.max(Number(file.width), Number(file.height)),
      area: Number(file.width) * Number(file.height),
    }))
    .sort((a, b) => {
      const aOver = a.longEdge > cap;
      const bOver = b.longEdge > cap;
      if (aOver !== bOver) return aOver ? 1 : -1;
      if (!aOver) return b.area - a.area;
      return a.area - b.area;
    });
  return ranked[0]?.file ?? null;
}

export function choosePexelsVideo(videos, options = {}) {
  const minDuration = finiteOrNull(options.minDuration);
  const maxDuration = finiteOrNull(options.maxDuration);
  const filtered = (videos ?? []).filter((video) => {
    const duration = Number(video?.duration);
    if (!Number.isFinite(duration)) return false;
    if (minDuration != null && duration < minDuration) return false;
    if (maxDuration != null && duration > maxDuration) return false;
    return chooseVideoFile(video, options.size) !== null;
  });
  const pool = filtered.length ? filtered : videos ?? [];
  if (!pool.length) return null;

  const target =
    minDuration != null && maxDuration != null
      ? (minDuration + maxDuration) / 2
      : minDuration ?? maxDuration ?? null;
  const ranked = pool
    .map((video, index) => ({
      video,
      file: chooseVideoFile(video, options.size),
      index,
      durationDistance:
        target == null || !Number.isFinite(Number(video.duration))
          ? 0
          : Math.abs(Number(video.duration) - target),
    }))
    .filter(({ file }) => file)
    .sort((a, b) => a.durationDistance - b.durationDistance || a.index - b.index);
  return ranked[0] ?? null;
}

export async function searchPexelsVideo(intent, ctx = {}, deps = {}) {
  loadProjectEnv(ctx.projectDir || process.cwd());
  const apiKey = deps.apiKey || process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const fetchImpl = deps.fetch || fetch;
  const envOrientation = process.env.PEXELS_VIDEO_ORIENTATION;
  const requestedOrientation = ctx.orientation || envOrientation || inferVideoOrientation(intent);
  const orientation = ORIENTATIONS.has(requestedOrientation) ? requestedOrientation : null;
  const requestedSize = ctx.size || process.env.PEXELS_VIDEO_SIZE || "medium";
  const size = SIZES.has(requestedSize) ? requestedSize : "medium";
  const locale = ctx.locale || process.env.PEXELS_VIDEO_LOCALE || "en-US";
  const perPage = clampInt(ctx.perPage || process.env.PEXELS_VIDEO_PER_PAGE, 1, 80, 40);

  const inferred = inferDurationRange(intent);
  const safeMin = finiteOrNull(
    ctx.minDuration ?? process.env.PEXELS_VIDEO_MIN_DURATION ?? inferred.min,
  );
  const safeMax = finiteOrNull(
    ctx.maxDuration ?? process.env.PEXELS_VIDEO_MAX_DURATION ?? inferred.max,
  );

  const params = new URLSearchParams({
    query: String(intent).trim(),
    per_page: String(perPage),
    locale,
    size,
  });
  if (orientation) params.set("orientation", orientation);

  const response = await fetchImpl(`${PEXELS_VIDEO_SEARCH}?${params}`, {
    headers: { Authorization: apiKey },
  });
  if (!response.ok) {
    const detail = response.text ? await response.text().catch(() => "") : "";
    throw new Error(
      `Pexels video search failed: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 240)}` : ""}`,
    );
  }
  const payload = await response.json();
  const selected = choosePexelsVideo(payload?.videos, {
    minDuration: safeMin,
    maxDuration: safeMax,
    size,
  });
  if (!selected) return null;

  const { video, file } = selected;
  return {
    url: file.link,
    ext: ".mp4",
    source: "search",
    metadata: {
      description: intent,
      duration: finiteOrNull(video.duration),
      width: finiteOrNull(file.width) || finiteOrNull(video.width),
      height: finiteOrNull(file.height) || finiteOrNull(video.height),
      provider: "pexels.video.search",
      provenance: {
        asset_id: video.id,
        asset_url: video.url,
        creator_name: video.user?.name || null,
        creator_url: video.user?.url || null,
        file_id: file.id || null,
        quality: file.quality || null,
        fps: file.fps || null,
        orientation,
        size,
        locale,
      },
    },
  };
}

export const pexelsVideoProvider = {
  search: searchPexelsVideo,
};
