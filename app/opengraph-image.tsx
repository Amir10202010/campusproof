import { ImageResponse } from "next/og";

export const alt = "CampusProof — проверенные фото университетов с источниками";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIERS = [
  { label: "Проверено", background: "#047857", color: "#ffffff" },
  { label: "Вероятно", background: "#fef3c7", color: "#461901" },
  { label: "Не подтверждено", background: "#f4f4f5", color: "#3f3f46" },
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
        background: "#0a0a0a",
        color: "#fafafa",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <svg width="88" height="88" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="8" fill="#262626" />
          <path
            d="M8 13V9a1 1 0 0 1 1-1h4M19 8h4a1 1 0 0 1 1 1v4M24 19v4a1 1 0 0 1-1 1h-4M13 24H9a1 1 0 0 1-1-1v-4"
            fill="none"
            stroke="#fafafa"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="m11.5 16.2 3 3 6-6.4"
            fill="none"
            stroke="#34d399"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ fontSize: 56, letterSpacing: -1 }}>CampusProof</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>Настоящие фото университета</div>
        <div style={{ fontSize: 38, color: "#a3a3a3" }}>
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
