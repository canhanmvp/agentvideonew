import { test } from "node:test";
import assert from "node:assert/strict";
import {
  choosePexelsVideo,
  inferDurationRange,
  inferVideoOrientation,
  searchPexelsVideo,
} from "./pexels-video-provider.mjs";

test("infers social-video orientation and duration hints", () => {
  assert.equal(inferVideoOrientation("TikTok vertical b-roll 9:16"), "portrait");
  assert.equal(inferVideoOrientation("square 1:1 product clip"), "square");
  assert.equal(inferVideoOrientation("cinematic landscape 16:9"), "landscape");
  assert.deepEqual(inferDurationRange("clip dài 6-10 giây"), { min: 6, max: 10 });
});

test("chooses a relevant-duration MP4 and a medium-sized rendition", () => {
  const selected = choosePexelsVideo(
    [
      {
        id: 1,
        duration: 22,
        video_files: [{ id: 11, file_type: "video/mp4", width: 1920, height: 1080, link: "a" }],
      },
      {
        id: 2,
        duration: 8,
        video_files: [
          { id: 21, file_type: "video/mp4", width: 2160, height: 3840, link: "too-large" },
          { id: 22, file_type: "video/mp4", width: 1080, height: 1920, link: "medium" },
        ],
      },
    ],
    { minDuration: 6, maxDuration: 10, size: "medium" },
  );
  assert.equal(selected.video.id, 2);
  assert.equal(selected.file.id, 22);
});

test("search sends Pexels authorization and returns attribution provenance", async () => {
  let requestUrl;
  let requestOptions;
  const result = await searchPexelsVideo(
    "woman planning her day, portrait 6-10 seconds",
    { projectDir: process.cwd() },
    {
      apiKey: "test-key",
      fetch: async (url, options) => {
        requestUrl = String(url);
        requestOptions = options;
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              videos: [
                {
                  id: 99,
                  duration: 8,
                  url: "https://www.pexels.com/video/99/",
                  user: {
                    name: "Test Creator",
                    url: "https://www.pexels.com/@creator/",
                  },
                  video_files: [
                    {
                      id: 991,
                      file_type: "video/mp4",
                      quality: "hd",
                      width: 1080,
                      height: 1920,
                      fps: 30,
                      link: "https://videos.pexels.com/video-files/test.mp4",
                    },
                  ],
                },
              ],
            };
          },
        };
      },
    },
  );

  const url = new URL(requestUrl);
  assert.equal(url.pathname, "/v1/videos/search");
  assert.equal(url.searchParams.get("orientation"), "portrait");
  assert.equal(url.searchParams.get("size"), "medium");
  assert.equal(requestOptions.headers.Authorization, "test-key");
  assert.equal(result.url, "https://videos.pexels.com/video-files/test.mp4");
  assert.equal(result.metadata.provider, "pexels.video.search");
  assert.equal(result.metadata.provenance.asset_id, 99);
  assert.equal(result.metadata.provenance.creator_name, "Test Creator");
  assert.equal(result.metadata.provenance.creator_url, "https://www.pexels.com/@creator/");
});
