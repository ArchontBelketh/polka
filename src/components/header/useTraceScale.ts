import { useEffect, type RefObject } from "react";

/**
 * Слой шапки нарисован в опорной ширине 2899px и привязан к центру.
 * Уже опорной — обрезается по краям (трассы уходят за экран).
 * Шире опорной — масштабируется целиком, чтобы чипы оставались на месте.
 * Хук пишет CSS-переменную --s на слой при каждом ресайзе.
 */
const NAT = 2899;

export function useTraceScale(
  headerRef: RefObject<HTMLDivElement | null>,
  layerRef: RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    const header = headerRef.current;
    const layer = layerRef.current;
    if (!header || !layer) return;

    const apply = () => {
      const w = header.clientWidth;
      const s = Math.max(1, w / NAT);
      layer.style.setProperty("--s", String(s));
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    return () => ro.disconnect();
  }, [headerRef, layerRef]);
}
