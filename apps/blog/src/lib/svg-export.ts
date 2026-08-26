// Turn a rendered chart SVG into a self-contained downloadable file —
// the weave leaving the site as a poster.
//
// The rendered SVG is styled entirely by CSS classes over theme tokens;
// a serialized copy has no stylesheet, so every visual property is
// inlined as a presentation attribute from computed style first, and a
// background rect is added (the live chart sits on the page's
// background; a transparent export renders on whatever a viewer's
// checkerboard happens to be). Pure client DOM work — exporting costs
// no upstream query, the Loom's standing promise.

/** The properties that carry a chart's entire look. */
const STYLED = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-size",
  "font-family",
] as const;

/**
 * A deep clone with computed styles inlined and classes stripped.
 * Exported separately from the download so the transformation is
 * testable without a click.
 */
export function inlineSvgStyles(svg: SVGSVGElement): SVGSVGElement {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const source = [svg, ...svg.querySelectorAll("*")];
  const target = [clone, ...clone.querySelectorAll("*")];
  source.forEach((el, i) => {
    const computed = window.getComputedStyle(el);
    for (const prop of STYLED) {
      const value = computed.getPropertyValue(prop);
      if (value) target[i].setAttribute(prop, value);
    }
    target[i].removeAttribute("class");
  });
  // The page's background, as the poster's ground. The namespace comes
  // from the LIVE element rather than a literal (which also keeps the
  // xmlns identifier from reading as a mixed-content URL to a linter —
  // it is an identifier, nothing is ever fetched from it), and
  // XMLSerializer emits the xmlns declaration for namespaced nodes on
  // its own.
  const bg = svg.ownerDocument.createElementNS(svg.namespaceURI, "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute(
    "fill",
    window.getComputedStyle(svg.ownerDocument.body).backgroundColor ||
      "#ffffff",
  );
  clone.insertBefore(bg, clone.firstChild);
  return clone;
}

/** Serialize, wrap in a blob, and hand the file to the browser. */
export function downloadSvg(svg: SVGSVGElement, name: string): void {
  const markup = new XMLSerializer().serializeToString(inlineSvgStyles(svg));
  const url = URL.createObjectURL(
    new Blob([markup], { type: "image/svg+xml" }),
  );
  const link = svg.ownerDocument.createElement("a");
  link.href = url;
  link.download = `${name}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}
