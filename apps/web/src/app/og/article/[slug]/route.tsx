import { ImageResponse } from "next/og";
import { getArticleBySlug } from "@/lib/source";

export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

const BG = "#0f0f23";
const ACCENT = "#a78bfa";
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
        padding: 64,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {frontmatter.tags.slice(0, 3).map((tag) => (
          <div
            key={tag}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: `1px solid ${ACCENT}66`,
              color: ACCENT,
              fontSize: 20,
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
          flexDirection: "column",
          gap: 18,
          marginTop: 24,
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
          {frontmatter.title.slice(0, 130)}
        </div>
        <div
          style={{
            fontSize: 26,
            color: MUTED,
            lineHeight: 1.4,
            maxWidth: 1050,
          }}
        >
          {frontmatter.description.slice(0, 180)}
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
