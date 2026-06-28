"use client"

import React from "react"

/**
 * Страница технических работ — ПОЛКА
 * Самостоятельный React-компонент. Все стили инлайновые;
 * @keyframes и шрифт подключаются через <style> внутри компонента.
 */

const ACCENT = "#6c63f6"
const ACCENT_LIGHT = "#8b85f9"

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#08080b",
    color: "#e9e9f0",
    fontFamily: "'Manrope', system-ui, sans-serif",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  glow: {
    position: "absolute",
    top: -340,
    left: "50%",
    transform: "translateX(-50%)",
    width: 1100,
    height: 720,
    background:
      "radial-gradient(ellipse at center, rgba(108,99,246,0.30), rgba(108,99,246,0.05) 45%, transparent 70%)",
    filter: "blur(18px)",
    pointerEvents: "none",
    animation: "polka-glow 6s ease-in-out infinite",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
    backgroundSize: "30px 30px",
    pointerEvents: "none",
    opacity: 0.5,
  },
  header: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "26px 40px",
  },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  brandName: {
    fontSize: 19,
    fontWeight: 800,
    letterSpacing: "-0.01em",
    color: "#fff",
  },
  statusLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "#9a9aab",
    textDecoration: "none",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#f0a93b",
    boxShadow: "0 0 10px rgba(240,169,59,0.7)",
  },
  main: {
    position: "relative",
    zIndex: 2,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "40px 24px 80px",
  },
  medallion: {
    position: "relative",
    width: 116,
    height: 116,
    marginBottom: 34,
  },
  medallionBg: {
    position: "absolute",
    inset: 0,
    borderRadius: 28,
    background:
      "linear-gradient(160deg, rgba(108,99,246,0.18), rgba(108,99,246,0.04))",
    border: "1px solid rgba(108,99,246,0.35)",
    boxShadow:
      "0 24px 60px -24px rgba(108,99,246,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  gear: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 56,
    height: 56,
    margin: "-28px 0 0 -28px",
    transformOrigin: "center",
    animation: "polka-spin 9s linear infinite",
  },
  h1: {
    margin: "0 0 22px",
    fontSize: 54,
    lineHeight: 1.04,
    fontWeight: 800,
    letterSpacing: "-0.025em",
    color: "#fff",
    maxWidth: 760,
  },
  lead: {
    margin: "0 0 40px",
    fontSize: 18,
    lineHeight: 1.6,
    color: "#9a9aab",
    maxWidth: 560,
  },
  actions: { display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
    padding: "13px 22px",
    borderRadius: 12,
    background: ACCENT,
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    textDecoration: "none",
    boxShadow: "0 16px 34px -16px rgba(108,99,246,0.9)",
  },
  btnGhost: {
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
    padding: "13px 22px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e9e9f0",
    fontSize: 15,
    fontWeight: 700,
    textDecoration: "none",
  },
  footer: {
    position: "relative",
    zIndex: 2,
    padding: "24px 40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    fontSize: 13,
    color: "#5c5c66",
  },
}

// Manrope подключён локально через @font-face в globals.css (без запроса к Google)
const KEYFRAMES = `
@keyframes polka-spin { to { transform: rotate(360deg); } }
@keyframes polka-glow { 0%, 100% { opacity: .55; } 50% { opacity: .9; } }
`

export interface MaintenancePageProps {
  /** E-mail поддержки */
  supportEmail?: string
  /** Ссылка на канал со статусом сервиса */
  statusUrl?: string
}

export default function MaintenancePage({
  supportEmail = "support@cyberpolka.store",
  statusUrl = "#",
}: MaintenancePageProps) {
  const [hover, setHover] = React.useState<string | null>(null)

  return (
    <div style={styles.root}>
      <style>{KEYFRAMES}</style>

      {/* ambient layers */}
      <div style={styles.glow} />
      <div style={styles.grid} />

      {/* header */}
      <header style={styles.header}>
        <div style={styles.brand}>
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ACCENT}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16.5 9.4 7.5 4.21" />
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <path d="M3.27 6.96 12 12.01l8.73-5.05" />
            <path d="M12 22.08V12" />
          </svg>
          <span style={styles.brandName}>
            <span style={{ color: ACCENT_LIGHT }}>CYBER</span>ПОЛКА
          </span>
        </div>
        <a href={statusUrl} style={styles.statusLink}>
          <span style={styles.statusDot} />
          Статус сервиса
        </a>
      </header>

      {/* main */}
      <main style={styles.main}>
        <div style={styles.medallion}>
          <div style={styles.medallionBg} />
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ACCENT_LIGHT}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={styles.gear}
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>

        <h1 style={styles.h1}>
          Идут <span style={{ color: ACCENT }}>технические&nbsp;работы</span>
        </h1>

        <p style={styles.lead}>
          Мы обновляем ПОЛКУ — улучшаем проверку кода и эскроу-защиту сделок.
          Каталог и покупки временно недоступны. Совсем скоро вернёмся.
        </p>

        <div style={styles.actions}>
          <a
            href={statusUrl}
            style={{
              ...styles.btnPrimary,
              background: hover === "primary" ? "#5b53e6" : ACCENT,
            }}
            onMouseEnter={() => setHover("primary")}
            onMouseLeave={() => setHover(null)}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.94 4.27a1.5 1.5 0 0 0-2.02-1.66L2.9 9.2c-1.2.46-1.18 2.18.03 2.61l4.27 1.5 1.6 5.1c.2.65 1.02.83 1.49.34l2.37-2.5 4.42 3.26c.6.44 1.46.12 1.62-.6l3.24-14.64z" />
            </svg>
            Канал статуса
          </a>
          <a
            href={`mailto:${supportEmail}`}
            style={{
              ...styles.btnGhost,
              background:
                hover === "ghost"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.04)",
            }}
            onMouseEnter={() => setHover("ghost")}
            onMouseLeave={() => setHover(null)}
          >
            Написать в поддержку
          </a>
        </div>
      </main>

      {/* footer */}
      <footer style={styles.footer}>
        <span>© {new Date().getFullYear()} CYBERПОЛКА</span>
        <span>{supportEmail}</span>
      </footer>
    </div>
  )
}
