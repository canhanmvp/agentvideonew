import { test } from "node:test";
import assert from "node:assert/strict";
import { generateElevenLabsSfx } from "./elevenlabs-sfx.mjs";

test("calls ElevenLabs text-to-sound with bounded generation options", async () => {
  let requestUrl;
  let requestOptions;
  const result = await generateElevenLabsSfx(
    {
      apiKey: "test-key",
      text: "clean digital whoosh",
      durationSeconds: 1.2,
      promptInfluence: 0.45,
    },
    {
      fetch: async (url, options) => {
        requestUrl = String(url);
        requestOptions = options;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "character-cost": "21", "request-id": "req-test" }),
          async arrayBuffer() {
            return Uint8Array.from([73, 68, 51]).buffer;
          },
        };
      },
    },
  );

  const url = new URL(requestUrl);
  assert.equal(url.pathname, "/v1/sound-generation");
  assert.equal(url.searchParams.get("output_format"), "mp3_44100_128");
  assert.equal(requestOptions.headers["xi-api-key"], "test-key");
  const body = JSON.parse(requestOptions.body);
  assert.equal(body.text, "clean digital whoosh");
  assert.equal(body.model_id, "eleven_text_to_sound_v2");
  assert.equal(body.duration_seconds, 1.2);
  assert.equal(body.prompt_influence, 0.45);
  assert.equal(result.bytes.toString(), "ID3");
  assert.equal(result.characterCost, "21");
  assert.equal(result.requestId, "req-test");
});

test("surfaces API errors without leaking the key", async () => {
  await assert.rejects(
    () =>
      generateElevenLabsSfx(
        { apiKey: "secret-test-key", text: "impact" },
        {
          fetch: async () => ({
            ok: false,
            status: 401,
            async text() {
              return "unauthorized";
            },
          }),
        },
      ),
    (error) => {
      assert.match(error.message, /HTTP 401/);
      assert.doesNotMatch(error.message, /secret-test-key/);
      return true;
    },
  );
});
