import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import numbers from "@/data/interlace-numbers.json";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

const BG = "#0a0a0a"; // GROUND in render-cover.sh
const ACCENT = "#f4794a"; // ORANGE in render-cover.sh — was violet-400
const TEXT = "#f5f5f5";
const MUTED = "#a3a3a3";

interface OgQuery {
  title?: string;
  description?: string;
  pageType?: "home" | "stats" | "articles" | "about";
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const params: OgQuery = {
    title: sp.get("title") ?? undefined,
    description: sp.get("description") ?? undefined,
    pageType: (sp.get("pageType") as OgQuery["pageType"]) ?? "home",
  };

  const title =
    params.title ?? "Ofri Peretz — Engineering Leader & Open Source Creator";
  const description =
    params.description ??
    `Architect of the Interlace ESLint Ecosystem. ${numbers.rules.total} rules across ${numbers.plugins.total} specialized plugins.`;
  const badge =
    params.pageType === "articles"
      ? "Articles"
      : params.pageType === "stats"
        ? "Stats"
        : params.pageType === "about"
          ? "About"
          : "Portfolio";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: BG,
        padding: 64,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            padding: "8px 16px",
            borderRadius: 999,
            border: `2px solid ${ACCENT}`,
            color: ACCENT,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {badge}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginTop: 32,
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: TEXT,
            lineHeight: 1.1,
          }}
        >
          {title.slice(0, 110)}
        </div>
        <div
          style={{
            fontSize: 28,
            color: MUTED,
            lineHeight: 1.4,
            maxWidth: 1000,
          }}
        >
          {description.slice(0, 180)}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: MUTED,
          fontSize: 22,
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              backgroundColor: ACCENT,
            }}
          />
          <span style={{ color: TEXT }}>ofriperetz.dev</span>
        </div>
        <span>@ofriperetzdev</span>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
