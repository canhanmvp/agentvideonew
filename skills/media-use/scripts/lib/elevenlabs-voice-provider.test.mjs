import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  chooseElevenLabsModel,
  elevenLabsTtsGenerate,
  looksVietnamese,
} from "./elevenlabs-voice-provider.mjs";

test("selects Flash v2.5 for Vietnamese and multilingual v2 otherwise", () => {
  assert.equal(looksVietnamese("Xin chào, hôm nay bạn khỏe không?"), true);
  assert.equal(chooseElevenLabsModel("Xin chào Việt Nam", null), "eleven_flash_v2_5");
  assert.equal(chooseElevenLabsModel("Welcome to the product", null), "eleven_multilingual_v2");
  assert.equal(chooseElevenLabsModel("Xin chào", "eleven_v3"), "eleven_v3");
});

test("generates an MP3 through the ElevenLabs TTS endpoint", async () => {
  let requestUrl;
  let requestOptions;
  const result = await elevenLabsTtsGenerate(
    "Xin chào Việt Nam",
    { projectDir: process.cwd(), voiceId: "voice-test" },
    {
      apiKey: "test-key",
      fetch: async (url, options) => {
        requestUrl = String(url);
        requestOptions = options;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "character-cost": "10" }),
          async arrayBuffer() {
            return Uint8Array.from([73, 68, 51]).buffer;
          },
        };
      },
    },
  );

  const url = new URL(requestUrl);
  assert.equal(url.pathname, "/v1/text-to-speech/voice-test");
  assert.equal(requestOptions.headers["xi-api-key"], "test-key");
  const body = JSON.parse(requestOptions.body);
  assert.equal(body.model_id, "eleven_flash_v2_5");
  assert.equal(result.metadata.provider, "elevenlabs.tts");
  assert.ok(existsSync(result.localPath));
  assert.equal(readFileSync(result.localPath).toString(), "ID3");
});
