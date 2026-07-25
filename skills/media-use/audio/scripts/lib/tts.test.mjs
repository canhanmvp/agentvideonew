import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  chooseElevenLabsModel,
  parseFfmpegDurationBanner,
  ffprobeDuration,
  synthesizeElevenLabs,
  synthesizeHeygen,
  synthResult,
} from "./tts.mjs";

test("parseFfmpegDurationBanner reads ffmpeg's stderr Duration line", () => {
  const stderr = [
    "ffmpeg version 6.0",
    "Input #0, wav, from 'a.wav':",
    "  Duration: 00:00:03.42, bitrate: 705 kb/s",
    "At least one output file must be specified",
  ].join("\n");
  assert.equal(parseFfmpegDurationBanner(stderr), 3.42);
});

test("parseFfmpegDurationBanner handles an hours component", () => {
  const stderr = "  Duration: 01:02:03.50, start: 0.000000, bitrate: 128 kb/s";
  assert.equal(parseFfmpegDurationBanner(stderr), 3723.5);
});

test("parseFfmpegDurationBanner returns NaN when there is no Duration line", () => {
  assert.ok(Number.isNaN(parseFfmpegDurationBanner("ffmpeg: command not found")));
  assert.ok(Number.isNaN(parseFfmpegDurationBanner("")));
  assert.ok(Number.isNaN(parseFfmpegDurationBanner(undefined)));
});

test("ffprobeDuration falls back to ffmpeg when ffprobe is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "tts-ffprobe-fallback-"));
  const fakeFfmpeg = join(dir, "ffmpeg");
  writeFileSync(
    fakeFfmpeg,
    "#!/bin/sh\necho 'Duration: 00:00:02.50, start: 0.000000, bitrate: 128 kb/s' 1>&2\nexit 1\n",
  );
  chmodSync(fakeFfmpeg, 0o755);
  const originalPath = process.env.PATH;
  try {
    process.env.PATH = dir;
    assert.equal(ffprobeDuration("/does/not/matter.wav"), 2.5);
  } finally {
    process.env.PATH = originalPath;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ffprobeDuration returns NaN when neither ffprobe nor ffmpeg resolve", () => {
  const dir = mkdtempSync(join(tmpdir(), "tts-no-binaries-"));
  const originalPath = process.env.PATH;
  try {
    process.env.PATH = dir;
    assert.ok(Number.isNaN(ffprobeDuration("/does/not/matter.wav")));
  } finally {
    process.env.PATH = originalPath;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ElevenLabs selects Flash v2.5 for Vietnamese", () => {
  assert.equal(chooseElevenLabsModel("vi"), "eleven_flash_v2_5");
  assert.equal(chooseElevenLabsModel("vi-VN"), "eleven_flash_v2_5");
  assert.equal(chooseElevenLabsModel("en"), "eleven_multilingual_v2");
});

test("synthesizeElevenLabs uses REST directly and writes the transcoded output", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tts-elevenlabs-"));
  const wavAbs = join(dir, "assets", "voice", "line-0.wav");
  let requestUrl;
  let requestOptions;
  try {
    const result = await synthesizeElevenLabs(
      {
        text: "Xin chào",
        voiceId: "voice-test",
        lang: "vi",
        speed: 1.1,
        wavAbs,
      },
      {
        apiKey: "test-key",
        fetch: async (url, options) => {
          requestUrl = String(url);
          requestOptions = options;
          return {
            ok: true,
            status: 200,
            async arrayBuffer() {
              return Uint8Array.from([73, 68, 51]).buffer;
            },
          };
        },
        transcodeToWav: (_bytes, dest) => {
          writeFileSync(dest, "RIFF-fake");
          return true;
        },
      },
    );
    assert.equal(result.ok, true);
    assert.ok(existsSync(wavAbs));
    const url = new URL(requestUrl);
    assert.equal(url.pathname, "/v1/text-to-speech/voice-test");
    assert.equal(requestOptions.headers["xi-api-key"], "test-key");
    const body = JSON.parse(requestOptions.body);
    assert.equal(body.model_id, "eleven_flash_v2_5");
    assert.equal(body.language_code, "vi");
    assert.equal(body.voice_settings.speed, 1.1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("synthesizeElevenLabs surfaces HTTP errors", async () => {
  const result = await synthesizeElevenLabs(
    { text: "hi", voiceId: "v", lang: "en", speed: 1, wavAbs: "/tmp/none.wav" },
    {
      apiKey: "test-key",
      fetch: async () => ({
        ok: false,
        status: 402,
        async text() {
          return "quota exceeded";
        },
      }),
    },
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /402/);
  assert.match(result.error, /quota exceeded/);
});

test("synthesizeHeygen surfaces a thrown HTTP error instead of swallowing it", async () => {
  const res = await synthesizeHeygen(
    { text: "hi", voiceId: "v1", lang: "en", speed: 1, wavAbs: "/tmp/x.wav" },
    {
      heygenAuthHeaders: () => ({}),
      heygenJSON: async () => {
        throw new Error("HeyGen POST /voices/speech → HTTP 402\nplan_upgrade_required");
      },
    },
  );
  assert.equal(res.ok, false);
  assert.match(res.error, /402/);
  assert.match(res.error, /plan_upgrade_required/);
});

test("synthesizeHeygen surfaces a failed audio_url fetch with its status", async () => {
  const res = await synthesizeHeygen(
    { text: "hi", voiceId: "v1", lang: "en", speed: 1, wavAbs: "/tmp/x.wav" },
    {
      heygenAuthHeaders: () => ({}),
      heygenJSON: async () => ({ data: { audio_url: "http://audio.example/x" } }),
      fetch: async () => ({ ok: false, status: 403 }),
    },
  );
  assert.equal(res.ok, false);
  assert.match(res.error, /HTTP 403/);
});

test("synthesizeHeygen reports a missing audio_url", async () => {
  const res = await synthesizeHeygen(
    { text: "hi", voiceId: "v1", lang: "en", speed: 1, wavAbs: "/tmp/x.wav" },
    { heygenAuthHeaders: () => ({}), heygenJSON: async () => ({}) },
  );
  assert.equal(res.ok, false);
  assert.match(res.error, /no audio_url/);
});

test("synthesizeHeygen reports wav transcode failures", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hf-tts-test-"));
  try {
    const res = await synthesizeHeygen(
      { text: "hi", voiceId: "v1", lang: "en", speed: 1, wavAbs: join(dir, "voice.wav") },
      {
        heygenAuthHeaders: () => ({}),
        heygenJSON: async () => ({ data: { audio_url: "http://audio.example/x" } }),
        fetch: async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }),
        transcodeToWav: () => false,
      },
    );
    assert.equal(res.ok, false);
    assert.equal(res.error, "wav transcode failed (ffmpeg)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("synthResult names a non-zero subprocess exit", () => {
  const res = synthResult({ status: 2 }, "/tmp/none.wav", "kokoro (npx hyperframes tts)");
  assert.equal(res.ok, false);
  assert.match(res.error, /kokoro .* exited with status 2/);
});
