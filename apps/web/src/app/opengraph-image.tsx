import { ImageResponse } from "next/og";
import { APP_VERSION } from "@/lib/version";
 
export const alt = "Victor Engineer - Rastreador de Entretenimiento";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.25), transparent 70%), radial-gradient(circle at 100% 100%, rgba(239, 68, 68, 0.1), transparent 50%)",
          padding: "60px 80px",
          fontFamily: "sans-serif",
          color: "#ffffff",
        }}
      >
        {/* Top bar with Victor Engineer Brand */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                backgroundColor: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 24px rgba(239, 68, 68, 0.4)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.5px" }}>VICTOR ENGINEER</span>
              <span style={{ fontSize: "13px", color: "#a1a1aa", letterSpacing: "1px", textTransform: "uppercase" }}>Personal Engineering Suite</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 18px",
              borderRadius: "9999px",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fb7185",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "9999px", backgroundColor: "#ef4444" }} />
            <span>{APP_VERSION} • Live Telemetry</span>
          </div>
        </div>

        {/* Center Hero Heading */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "900px" }}>
          <h1
            style={{
              fontSize: "64px",
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: "-2px",
              margin: 0,
              background: "linear-gradient(90deg, #ffffff 0%, #ffffff 60%, #ef4444 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            Rastreador de Entretenimiento
          </h1>
          <p style={{ fontSize: "24px", color: "#a1a1aa", margin: 0, lineHeight: 1.4 }}>
            Centro de comando y telemetría para videojuegos, cinefilia y series de tiempo con enriquecimiento contextual por Gemini IA.
          </p>
        </div>

        {/* Bottom Feature Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {[
            { label: "Steam Live Tracker", color: "#38bdf8" },
            { label: "Notion SSoT Sync", color: "#fb7185" },
            { label: "HLTB Integration", color: "#fbbf24" },
            { label: "Gemini AI Vibe", color: "#34d399" },
            { label: "Local-First SQLite", color: "#a78bfa" },
          ].map((b) => (
            <div
              key={b.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "14px",
                backgroundColor: "#18181b",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                fontSize: "15px",
                fontWeight: 600,
                color: "#e4e4e7",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "9999px", backgroundColor: b.color }} />
              <span>{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
