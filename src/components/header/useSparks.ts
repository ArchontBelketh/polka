import { useEffect, type RefObject } from "react";

/**
 * Искры на трассах через Web Animations API.
 * У каждой трассы есть свой выключенный «спарк-оверлей». Планировщик держит
 * ровно ACTIVE_COUNT активных искр: по завершении пробега, после случайной
 * паузы, зажигается новая случайная трасса. Состояние трасс не мутируется.
 * За экраном анимации ставятся на паузу; учитывается prefers-reduced-motion.
 */
const PALETTE = ["#5CF6F0", "#34E6E0", "#9D8CFF", "#C77DFF", "#BFFFFB"];
const ACTIVE_COUNT = 7;
const DUR_MIN = 2600;
const DUR_MAX = 6000;
const GAP_MIN = 120;
const GAP_MAX = 1400;
const SVGNS = "http://www.w3.org/2000/svg";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export function useSparks(
  headerRef: RefObject<HTMLDivElement | null>,
  traceGroupRef: RefObject<SVGGElement | null>,
  sparkGroupRef: RefObject<SVGGElement | null>
) {
  useEffect(() => {
    const sparkG = sparkGroupRef.current;
    const traceG = traceGroupRef.current;
    const header = headerRef.current;
    if (!sparkG || !traceG) return;

    const traceEls = Array.from(traceG.querySelectorAll("path"));
    if (!traceEls.length) return;

    // по одному выключенному оверлею на каждую трассу
    const sparks = traceEls.map((t) => {
      const p = document.createElementNS(SVGNS, "path");
      p.setAttribute("d", t.getAttribute("d") || "");
      p.setAttribute("pathLength", "1000");
      p.setAttribute("class", "spark");
      p.style.strokeDashoffset = "60";
      p.style.visibility = "hidden";
      sparkG.appendChild(p);
      return p;
    });

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      return () => sparks.forEach((s) => s.remove());
    }

    const active = new Set<number>();
    const anims: Record<number, Animation> = {};
    let onscreen = true;
    let cancelled = false;

    const pickInactive = (): number => {
      if (active.size >= sparks.length) return -1;
      let i: number;
      do {
        i = Math.floor(Math.random() * sparks.length);
      } while (active.has(i));
      return i;
    };

    const launch = (i: number) => {
      if (i < 0 || cancelled) return;
      active.add(i);
      const el = sparks[i];
      el.style.color = pick(PALETTE);
      el.style.visibility = "visible";

      // dasharray 60/1940 => на трассе один штрих; гоним один проход.
      const anim = el.animate(
        [{ strokeDashoffset: 60 }, { strokeDashoffset: -1000 }],
        { duration: rand(DUR_MIN, DUR_MAX), easing: "linear" }
      );
      anims[i] = anim;
      if (!onscreen) anim.pause();

      anim.onfinish = () => {
        el.style.visibility = "hidden";
        active.delete(i);
        delete anims[i];
        window.setTimeout(() => launch(pickInactive()), rand(GAP_MIN, GAP_MAX));
      };
    };

    for (let k = 0; k < ACTIVE_COUNT; k++) launch(pickInactive());

    let io: IntersectionObserver | undefined;
    if (header && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          onscreen = entries[0].isIntersecting;
          for (const key in anims) {
            if (onscreen) anims[key].play();
            else anims[key].pause();
          }
        },
        { threshold: 0 }
      );
      io.observe(header);
    }

    return () => {
      cancelled = true;
      io?.disconnect();
      Object.values(anims).forEach((a) => a.cancel());
      sparks.forEach((s) => s.remove());
    };
  }, [headerRef, traceGroupRef, sparkGroupRef]);
}
