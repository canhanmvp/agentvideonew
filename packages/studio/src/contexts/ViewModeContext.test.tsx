// @vitest-environment happy-dom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ViewModeProvider, useViewMode, useViewModeState } from "./ViewModeContext";
import { ViewModeToggle } from "../components/StudioHeader";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe() {
  const value = useViewMode();
  return <span data-mode={value.viewMode}>{value.viewMode}</span>;
}

function App() {
  const value = useViewModeState();
  return (
    <ViewModeProvider value={value}>
      <Probe />
      <ViewModeToggle />
    </ViewModeProvider>
  );
}

function renderApp(): { host: HTMLDivElement; root: Root } {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<App />));
  return { host, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
});

describe("Studio strategy view mode", () => {
  it("opens from the strategy deep link", () => {
    window.history.replaceState(null, "", "/?view=strategy");
    const { host, root } = renderApp();
    expect(host.querySelector("[data-mode]")?.textContent).toBe("strategy");
    expect(host.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe("Strategy");
    act(() => root.unmount());
  });

  it("supports arrow-key navigation across all three views", () => {
    window.history.replaceState(null, "", "/?view=strategy");
    const { host, root } = renderApp();
    const strategy = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
      (button) => button.textContent === "Strategy",
    );
    if (!strategy) throw new Error("Strategy tab not found");
    act(() =>
      strategy.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
    );
    expect(host.querySelector("[data-mode]")?.textContent).toBe("storyboard");
    expect(window.location.search).toBe("?view=storyboard");
    act(() => root.unmount());
  });
});
