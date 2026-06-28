"use client"

import { useRef, useState, type CSSProperties } from "react"
import Link from "next/link"
import { signOut } from "next-auth/react"
import { Menu, X, Search, LogIn } from "lucide-react"
import { TRACE_PATHS, CHIP_PATHS, NODES, HOT_NODES } from "./headerTraces"
import { useTraceScale } from "./useTraceScale"
import { useSparks } from "./useSparks"
import { UserMenu } from "@/components/layout/UserMenu"

/**
 * Кибер-шапка CYBERПОЛКА. Декор (трассы/чипы/узлы/искры) и интерактив живут в
 * одной координатной системе 2899×84, привязанной к центру (как в исходном
 * макете). Декоративный слой обрезается по краям; интерактивный — НЕ обрезается
 * (чтобы выпадающее меню не клипалось). Масштаб --s задаётся на контейнере.
 * Данные (авторизация, непрочитанные) приходят пропсами из серверного Navbar.
 */

const CYAN = "#34E6E0"
const VIOLET = "#9D8CFF"
const DEEP = "#6C4BF5"

interface CyberHeaderProps {
  authed: boolean
  role?: string
  unread: number
  messagesHref: string
}

export default function CyberHeader({ authed, role, unread, messagesHref }: CyberHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const traceGroupRef = useRef<SVGGElement>(null)
  const sparkGroupRef = useRef<SVGGElement>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  // --s ставится на headerRef; оба слоя (декор и интерактив) наследуют его.
  useTraceScale(headerRef, headerRef)
  useSparks(headerRef, traceGroupRef, sparkGroupRef)

  const isMod = role === "MODERATOR" || role === "ADMIN"
  const homeHref = isMod ? "/admin" : "/dashboard"
  const homeLabel = isMod ? "Рабочий стол" : "Кабинет"

  const ambBg =
    "radial-gradient(300px 130px at 43% 50%, rgba(108,75,245,0.26), transparent 70%)," +
    "radial-gradient(300px 130px at 57.8% 50%, rgba(52,230,224,0.22), transparent 70%)," +
    "radial-gradient(1100px 80px at 50% 60%, rgba(52,230,224,0.06), transparent 75%)"

  const closeMobile = () => setMobileOpen(false)

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#0A0912",
        borderBottom: "1px solid #1C1830",
      }}
    >
      <div ref={headerRef} style={{ position: "relative", height: 84 }}>
        {/* ── ДЕКОРАТИВНЫЙ СЛОЙ (обрезается по краям) ── */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={layerBase}>
            <div className="amb" style={{ position: "absolute", inset: 0, background: ambBg }} />
            <svg
              viewBox="0 0 2899 84"
              width={2899}
              height={84}
              fill="none"
              style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
            >
              <defs>
                <linearGradient id="traceGrad" x1="0" y1="0" x2="760" y2="0" gradientUnits="userSpaceOnUse" spreadMethod="repeat">
                  <stop offset="0" stopColor="#34E6E0" />
                  <stop offset="0.2" stopColor="#3FC9F0" />
                  <stop offset="0.4" stopColor="#5B8CF5" />
                  <stop offset="0.6" stopColor="#9D8CFF" />
                  <stop offset="0.8" stopColor="#C77DFF" />
                  <stop offset="1" stopColor="#34E6E0" />
                  <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="760 0" dur="7s" repeatCount="indefinite" />
                </linearGradient>
                <radialGradient id="nodeGlow" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0" stopColor="#BFFFFB" />
                  <stop offset="0.45" stopColor="#1FA9A6" />
                  <stop offset="1" stopColor="#0A0912" />
                </radialGradient>
              </defs>

              {/* ТРАССЫ */}
              <g ref={traceGroupRef} className="trace-glow" stroke="url(#traceGrad)" strokeWidth={2} strokeOpacity={0.52} strokeLinecap="round" strokeLinejoin="round" fill="none">
                {TRACE_PATHS.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>

              {/* ЧИПЫ */}
              <g className="chip-glow" fill="#0E0C1A" stroke="url(#traceGrad)" strokeWidth={1.1} strokeOpacity={0.75} strokeLinejoin="round" strokeLinecap="round">
                {CHIP_PATHS.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>

              {/* УЗЛЫ */}
              <g className="node-grp" stroke="#34E6E0" strokeWidth={1.3} strokeOpacity={0.8} fill="url(#nodeGlow)">
                {NODES.map((n, i) => (
                  <circle key={i} cx={n.cx} cy={n.cy} r={n.r} />
                ))}
              </g>

              {/* ГОРЯЧИЕ УЗЛЫ */}
              <g fill="currentColor">
                {HOT_NODES.map((h, i) => (
                  <circle key={i} className="hot" cx={h.cx} cy={h.cy} r={h.r} style={{ color: h.color, animationDelay: h.delay }} />
                ))}
              </g>

              {/* ИСКРЫ (оверлеи строятся в useSparks) */}
              <g ref={sparkGroupRef} fill="none" />
            </svg>
          </div>
        </div>

        {/* ── ИНТЕРАКТИВНЫЙ СЛОЙ — ДЕСКТОП (та же система координат, без обрезки) ── */}
        <div className="cyber-ui-desktop" style={layerBase}>
          {/* ЛОГО — центр левого чипа (1247.5) */}
          <Link href="/" style={logoStyle}>
            <LogoContent />
          </Link>

          {/* ПОИСК — между чипами (1461) */}
          <form action="/catalog" style={searchStyle}>
            <Search size={15} color="#6B6781" strokeWidth={2} />
            <input
              name="q"
              placeholder="Поиск продуктов…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#EDEAF7", fontFamily: "'Exo 2',sans-serif", fontSize: 13, minWidth: 0 }}
            />
          </form>

          {/* ПРАВЫЙ ЧИП (1674.5): гость → «Войти»; вошедший → меню (с индикатором сообщений) */}
          {authed ? (
            <div style={{ position: "absolute", left: 1674.5, top: 42.5, transform: "translate(-50%,-50%)" }}>
              <UserMenu role={role} unread={unread} messagesHref={messagesHref} />
            </div>
          ) : (
            <Link href="/login" className="header-btn" style={headerBtnStyle}>
              <LogIn size={14} strokeWidth={2} />
              Войти
            </Link>
          )}
        </div>

        {/* ── ИНТЕРАКТИВНЫЙ СЛОЙ — МОБАЙЛ (бар) ── */}
        <div className="cyber-ui-mobile" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "space-between", padding: "0 16px", zIndex: 2 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }} onClick={closeMobile}>
            <LogoContent />
          </Link>
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Меню"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 10, background: "#13111E", border: "1px solid #2C2748", color: "#EDEAF7", cursor: "pointer" }}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── МОБИЛЬНАЯ ПАНЕЛЬ (выпадает под шапкой) ── */}
      {mobileOpen && (
        <div className="cyber-ui-mobile" style={{ flexDirection: "column", gap: 4, padding: "12px 16px 16px", background: "#0A0912", borderTop: "1px solid #1C1830" }}>
          <form action="/catalog" style={{ ...searchStyle, position: "static", transform: "none", width: "auto", marginBottom: 6 }}>
            <Search size={16} color="#6B6781" strokeWidth={2} />
            <input name="q" placeholder="Поиск продуктов…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#EDEAF7", fontFamily: "'Exo 2',sans-serif", fontSize: 14, minWidth: 0 }} />
          </form>

          <Link href="/catalog" style={mLink} onClick={closeMobile}>Каталог</Link>

          {authed ? (
            <>
              <Link href={homeHref} style={mLink} onClick={closeMobile}>{homeLabel}</Link>
              {role === "DEVELOPER" && <Link href="/submit" style={mLink} onClick={closeMobile}>Загрузить продукт</Link>}
              {!isMod && role !== "DEVELOPER" && <Link href="/sell" style={mLink} onClick={closeMobile}>Продавать</Link>}
              <Link href={messagesHref} style={mLink} onClick={closeMobile}>Сообщения{unread > 0 ? ` (${unread})` : ""}</Link>
              <Link href="/settings" style={mLink} onClick={closeMobile}>Настройки</Link>
              <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ ...mLink, color: "#ef4444", background: "transparent", border: "none", textAlign: "left", cursor: "pointer", width: "100%" }}>Выход</button>
            </>
          ) : (
            <>
              <Link href="/sell" style={mLink} onClick={closeMobile}>Продавать</Link>
              <Link href="/login" style={mPrimary} onClick={closeMobile}>Войти</Link>
            </>
          )}
        </div>
      )}
    </header>
  )
}

/* Лого-марка + текст CYBERПОЛКА (переиспользуется в десктопе и мобайле) */
function LogoContent() {
  return (
    <>
      <div style={logoMarkStyle}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2.5 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5 }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: 13, color: VIOLET, lineHeight: 1 }}>&gt;</span>
            <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
              <div style={{ width: 3.5, height: 6, borderRadius: 1.5, background: CYAN }} />
              <div style={{ width: 3.5, height: 9, borderRadius: 1.5, background: VIOLET }} />
            </div>
          </div>
          <div style={{ width: 22, height: 2.5, borderRadius: 2, background: DEEP }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 0.88 }}>
        <span style={{ fontFamily: "'Exo 2',sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: "0.06em", color: CYAN, textShadow: "0 0 8px rgba(52,230,224,.6)" }}>CYBER</span>
        <span style={{ fontFamily: "'Exo 2',sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: "0.06em", color: "#EDEAF7", textShadow: "0 0 8px rgba(157,140,255,.4)" }}>ПОЛКА</span>
      </div>
    </>
  )
}

const layerBase: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: 2899,
  height: 84,
  transformOrigin: "center center",
  transform: "translate(-50%,-50%) scale(var(--s,1))",
}

const logoStyle: CSSProperties = {
  position: "absolute",
  left: 1247.5,
  top: 42.5,
  transform: "translate(-50%,-50%)",
  display: "flex",
  alignItems: "center",
  gap: 9,
  textDecoration: "none",
  cursor: "pointer",
}

const logoMarkStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "linear-gradient(145deg,#16132A,#0C0A18)",
  border: "1px solid #3A3460",
  boxShadow: "0 0 12px rgba(108,75,245,.45), inset 0 0 8px rgba(52,230,224,.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
}

const searchStyle: CSSProperties = {
  position: "absolute",
  left: 1461,
  top: 42.5,
  transform: "translate(-50%,-50%)",
  width: 248,
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "#13111E",
  border: "1px solid #2C2748",
  borderRadius: 10,
  padding: "0 12px",
  height: 38,
  boxShadow: "inset 0 0 10px rgba(52,230,224,.07), 0 0 0 1px rgba(52,230,224,.04)",
}

const headerBtnStyle: CSSProperties = {
  position: "absolute",
  left: 1674.5,
  top: 42.5,
  transform: "translate(-50%,-50%)",
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "'Exo 2',sans-serif",
  fontWeight: 700,
  fontSize: 13,
  color: "#FFFFFF",
  background: "linear-gradient(135deg,#7C5DFF,#5B3FE0)",
  border: "1px solid rgba(157,140,255,.6)",
  borderRadius: 9,
  padding: "8px 14px",
  cursor: "pointer",
  textDecoration: "none",
  transition: "box-shadow .2s, transform .12s",
  boxShadow: "0 0 14px rgba(108,75,245,.55), inset 0 1px 0 rgba(255,255,255,.18)",
}

const mLink: CSSProperties = {
  display: "block",
  padding: "10px 12px",
  borderRadius: 10,
  fontFamily: "'Exo 2',sans-serif",
  fontSize: 15,
  color: "#D7D2E6",
  textDecoration: "none",
}

const mPrimary: CSSProperties = {
  ...mLink,
  marginTop: 4,
  textAlign: "center",
  fontWeight: 700,
  color: "#FFFFFF",
  background: "linear-gradient(135deg,#7C5DFF,#5B3FE0)",
  border: "1px solid rgba(157,140,255,.6)",
}
