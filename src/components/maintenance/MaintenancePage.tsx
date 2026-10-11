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
  logoBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: "linear-gradient(145deg,#16132A,#0C0A18)",
    border: "1px solid #3A3460",
    boxShadow: "0 0 12px rgba(108,75,245,.45), inset 0 0 8px rgba(52,230,224,.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logoInner: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2.5 },
  logoRow: { display: "flex", alignItems: "flex-end", gap: 2.5 },
  logoChevron: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 800,
    fontSize: 12,
    color: "#9D8CFF",
    lineHeight: 1,
  },
  logoBars: { display: "flex", gap: 2, alignItems: "flex-end" },
  logoUnderline: { width: 21, height: 2.5, borderRadius: 2, background: "#6C4BF5" },
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
  formWrap: {
    width: "100%",
    maxWidth: 460,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    textAlign: "left",
    marginBottom: 18,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: "#b9b9c6" },
  input: {
    width: "100%",
    padding: "11px 13px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e9e9f0",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  },
  textarea: { minHeight: 110, resize: "vertical" },
  hp: { position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" },
  loginRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    fontSize: 14,
    color: "#7a7a88",
  },
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
}

export default function MaintenancePage({
  supportEmail = "support@cyberpolka.store",
}: MaintenancePageProps) {
  const [form, setForm] = React.useState({ email: "", subject: "", message: "", name: "", company: "" })
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">("idle")
  const [err, setErr] = React.useState<string | null>(null)

  function upd(key: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [key]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("sending")
    setErr(null)
    try {
      const res = await fetch("/api/support/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(typeof d.error === "string" ? d.error : "Ошибка отправки")
        setStatus("error")
        return
      }
      setStatus("sent")
    } catch {
      setErr("Ошибка соединения")
      setStatus("error")
    }
  }

  return (
    <div style={styles.root}>
      <style>{KEYFRAMES}</style>

      {/* ambient layers */}
      <div style={styles.glow} />
      <div style={styles.grid} />

      {/* header */}
      <header style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.logoBox}>
            <div style={styles.logoInner}>
              <div style={styles.logoRow}>
                <span style={styles.logoChevron}>&gt;</span>
                <div style={styles.logoBars}>
                  <div style={{ width: 3.5, height: 6, borderRadius: 1.5, background: "#34E6E0" }} />
                  <div style={{ width: 3.5, height: 9, borderRadius: 1.5, background: "#9D8CFF" }} />
                </div>
              </div>
              <div style={styles.logoUnderline} />
            </div>
          </div>
          <span style={styles.brandName}>
            <span style={{ color: "#34E6E0" }}>CYBER</span>ПОЛКА
          </span>
        </div>
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
          Мы обновляем ПОЛКУ — улучшаем проверку кода и безопасность сделок.
          Каталог и покупки временно недоступны. Совсем скоро вернёмся.
        </p>

        {status === "sent" ? (
          <div style={{ ...styles.formWrap, textAlign: "center", alignItems: "center" }}>
            <p style={{ color: "#5fd08a", fontWeight: 700, fontSize: 17, margin: 0 }}>Сообщение отправлено ✓</p>
            <p style={{ color: "#9a9aab", fontSize: 14, margin: 0 }}>Ответим на {form.email}.</p>
          </div>
        ) : (
          <form onSubmit={submit} style={styles.formWrap}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#e9e9f0", margin: "0 0 2px" }}>
              Нужна помощь? Напишите нам
            </p>
            <div style={styles.field}>
              <label style={styles.label}>Email для ответа</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => upd("email", e.target.value)}
                style={styles.input}
                placeholder="you@example.com"
                maxLength={200}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Тема обращения</label>
              <input
                required
                value={form.subject}
                onChange={(e) => upd("subject", e.target.value)}
                style={styles.input}
                placeholder="Коротко о вопросе"
                maxLength={200}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Сообщение</label>
              <textarea
                required
                value={form.message}
                onChange={(e) => upd("message", e.target.value)}
                style={{ ...styles.input, ...styles.textarea }}
                placeholder="Опишите вопрос…"
                maxLength={5000}
              />
            </div>
            {/* honeypot — скрыт от людей, ловит ботов */}
            <input
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={styles.hp}
              value={form.company}
              onChange={(e) => upd("company", e.target.value)}
            />
            {err && <p style={{ color: "#f08b8b", fontSize: 13, margin: 0 }}>{err}</p>}
            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                ...styles.btnPrimary,
                justifyContent: "center",
                border: "none",
                cursor: status === "sending" ? "default" : "pointer",
                opacity: status === "sending" ? 0.7 : 1,
              }}
            >
              {status === "sending" ? "Отправка…" : "Отправить обращение"}
            </button>
          </form>
        )}

        <div style={styles.loginRow}>
          <a href="/login" style={{ color: ACCENT_LIGHT, textDecoration: "none", fontWeight: 600 }}>
            Войти
          </a>
          <span>·</span>
          <span>
            или на почту{" "}
            <a href={`mailto:${supportEmail}`} style={{ color: ACCENT_LIGHT, textDecoration: "none" }}>
              {supportEmail}
            </a>
          </span>
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
