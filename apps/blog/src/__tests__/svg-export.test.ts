// @vitest-environment jsdom
/**
 * svg-export — the poster leaves self-contained.
 *
 * The rendered chart is styled entirely by CSS classes; a serialized
 * copy has no stylesheet, so the export inlines computed styles as
 * presentation attributes. These lock the transformation (testable
 * without a click); the download handoff itself is a browser API call.
 */
import { describe, expect, it } from "vitest";

import { inlineSvgStyles } from "../lib/svg-export";

const chart = (): SVGSVGElement => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 50");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M0,0L100,50");
  path.setAttribute("class", "stroke-chart-1");
  svg.appendChild(path);
  document.body.appendChild(svg);
  return svg;
};

describe("inlineSvgStyles", () => {
  it("returns a CLONE — the live chart is never mutated", () => {
    const svg = chart();
    const clone = inlineSvgStyles(svg);
    expect(clone).not.toBe(svg);
    expect(svg.querySelector("path")?.getAttribute("class")).toBe(
      "stroke-chart-1",
    );
  });

  it("strips classes — a class without its stylesheet is a lie", () => {
    const clone = inlineSvgStyles(chart());
    expect(clone.querySelector("path")?.getAttribute("class")).toBeNull();
  });

  it("inlines computed style as presentation attributes", () => {
    const clone = inlineSvgStyles(chart());
    // jsdom's computed values are defaults, but the mechanism is what is
    // locked: whatever getComputedStyle reports lands as an attribute.
    expect(clone.querySelector("path")?.getAttribute("fill")).not.toBeNull();
  });

  it("adds a ground rect, and serializes with the xmlns a standalone file needs", () => {
    const clone = inlineSvgStyles(chart());
    const first = clone.firstElementChild;
    expect(first?.tagName.toLowerCase()).toBe("rect");
    expect(first?.getAttribute("width")).toBe("100%");
    expect(first?.getAttribute("fill")).toBeTruthy();
    // The rect inherits the LIVE svg's namespace (never a literal), so
    // XMLSerializer emits the xmlns declaration on its own.
    expect(first?.namespaceURI).toBe(clone.namespaceURI);
    expect(new XMLSerializer().serializeToString(clone)).toContain("xmlns=");
  });
});
