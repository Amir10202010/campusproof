import { ImageResponse } from "next/og";

export const alt = "CampusProof — проверенные фото университетов с источниками";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Hex copies of the design tokens in app/globals.css: an ImageResponse is rendered on the server with
 * no stylesheet, so it cannot read the CSS variables. Keep these in step with the dark theme.
 */
const INK = "#0b0e14";
const PANEL = "#11151d";
const PAPER = "#f3f4f7";
const DIM = "#9da3af";
const CHECK = "#29cd95";

const TIERS = [
  { label: "Проверено", background: "#00734d", color: "#ffffff" },
  { label: "Вероятно", background: "#fdf0c7", color: "#512a03" },
  { label: "Не подтверждено", background: "#eff1f5", color: "#4b505b" },
];

/** P4 · #36 · link preview (Telegram, WhatsApp, Slack): name, slogan and the three trust tiers. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: INK,
        color: PAPER,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width="80" height="80" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="9" fill={PANEL} />
          <path
            d="M8 13V9a1 1 0 0 1 1-1h4M19 8h4a1 1 0 0 1 1 1v4M24 19v4a1 1 0 0 1-1 1h-4M13 24H9a1 1 0 0 1-1-1v-4"
            fill="none"
            stroke={PAPER}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="m11.5 16.2 3 3 6-6.4"
            fill="none"
            stroke={CHECK}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Satori needs an explicit display on any element with more than one child. */}
        <div style={{ display: "flex", fontSize: 52, letterSpacing: -1 }}>
          <span>Campus</span>
          <span style={{ color: CHECK }}>Proof</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2.5 }}>Настоящие фото университета</div>
        <div style={{ fontSize: 36, color: DIM, lineHeight: 1.3 }}>
          У каждого снимка — источник, дата и уровень доверия с доказательствами
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {TIERS.map((tier) => (
          <div
            key={tier.label}
            style={{
              display: "flex",
              padding: "10px 24px",
              borderRadius: 999,
              fontSize: 30,
              background: tier.background,
              color: tier.color,
            }}
          >
            {tier.label}
          </div>
        ))}
      </div>
    </div>,
    { ...size },
  );
}
