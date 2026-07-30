import { ImageResponse } from "next/og";
import { getArticleBySlug } from "@/lib/source";

// dev.to article cover ratio (1000x420). The 1200x630 social/OG card lives at
// /og/article/[slug]; this is the in-article + feed cover sized for dev.to.
export const contentType = "image/png";
export const size = { width: 1000, height: 420 };

const BG = "#0a0a0a"; // GROUND in render-cover.sh
const ACCENT = "#f4794a"; // ORANGE in render-cover.sh — was violet-400
const TEXT = "#f5f5f5";
const MUTED = "#a3a3a3";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) {
    return new Response("Not found", { status: 404 });
  }
  const { frontmatter, readingTimeMinutes } = article;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: BG,
        padding: 56,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {frontmatter.tags.slice(0, 3).map((tag) => (
          <div
            key={tag}
            style={{
              padding: "5px 13px",
              borderRadius: 999,
              border: `1px solid ${ACCENT}66`,
              color: ACCENT,
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: "lowercase",
            }}
          >
            {tag}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 48,
          fontWeight: 800,
          color: TEXT,
          lineHeight: 1.12,
          marginTop: 16,
        }}
      >
        {frontmatter.title.slice(0, 120)}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: MUTED,
          fontSize: 20,
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 11,
              height: 11,
              borderRadius: 999,
              backgroundColor: ACCENT,
            }}
          />
          <span style={{ color: TEXT }}>Ofri Peretz</span>
          <span>·</span>
          <span>{readingTimeMinutes} min read</span>
        </div>
        <span>ofriperetz.dev</span>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
