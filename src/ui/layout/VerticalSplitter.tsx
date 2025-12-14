import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  top: React.ReactNode;
  bottom: React.ReactNode;

  /** Altezza iniziale pannello top (px) */
  initialTopPx?: number;

  /** Minimi (px) */
  minTopPx?: number;
  minBottomPx?: number;

  /** Spessore splitter (px) */
  splitterPx?: number;

  /** Callback utile se vuoi triggerare resize del viewer dopo apply */
  onApplySize?: (topPx: number) => void;
};

export function VerticalSplitter({
  top,
  bottom,
  initialTopPx = 520,
  minTopPx = 220,
  minBottomPx = 180,
  splitterPx = 8,
  onApplySize,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [topPx, setTopPx] = useState(initialTopPx);

  // Drag state (ghost line)
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startTopRef = useRef(0);
  const ghostTopRef = useRef<number | null>(null);

  const [, forceRerender] = useState(0); // usata solo per aggiornare la ghost line

  const clampTop = (wantedTop: number) => {
    const el = containerRef.current;
    if (!el) return wantedTop;

    const total = el.getBoundingClientRect().height;
    const maxTop = total - splitterPx - minBottomPx;
    return Math.max(minTopPx, Math.min(wantedTop, maxTop));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;

    draggingRef.current = true;
    startYRef.current = e.clientY;
    startTopRef.current = topPx;
    ghostTopRef.current = topPx;

    // cattura mouse anche se esci dal container
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  };

  const onWindowMouseMove = (e: MouseEvent) => {
    if (!draggingRef.current) return;

    const dy = e.clientY - startYRef.current;
    const wanted = startTopRef.current + dy;
    ghostTopRef.current = clampTop(wanted);
    forceRerender((x) => x + 1); // aggiorna posizione ghost line
  };

  const onWindowMouseUp = () => {
    if (!draggingRef.current) return;

    draggingRef.current = false;

    const applied = ghostTopRef.current ?? topPx;
    ghostTopRef.current = null;

    // apply SOLO qui (no live resize)
    setTopPx(applied);

    // Aspetta che il DOM applichi davvero le nuove dimensioni (1 frame)
    // così il viewer legge il rect corretto e non perde il ratio.
    requestAnimationFrame(() => {
      onApplySize?.(applied);
    });

    window.removeEventListener("mousemove", onWindowMouseMove);
    window.removeEventListener("mouseup", onWindowMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  useEffect(() => {
    return () => {
      // cleanup in caso di unmount durante drag
      window.removeEventListener("mousemove", onWindowMouseMove);
      window.removeEventListener("mouseup", onWindowMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gridTemplateRows = useMemo(
    () => `${topPx}px ${splitterPx}px 1fr`,
    [topPx, splitterPx]
  );

  const ghostTop = ghostTopRef.current;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {/* Ghost line (solo durante drag) */}
      {ghostTop != null && (
        <div
          className="pointer-events-none absolute left-0 right-0 z-50"
          style={{ top: ghostTop, height: splitterPx }}
        >
          <div className="h-full w-full bg-sky-500/50 ring-1 ring-sky-600/40 rounded-sm" />
        </div>
      )}

      <div
        className="grid h-full w-full"
        style={{ gridTemplateRows }}
      >
        <div className="min-h-0 overflow-hidden">{top}</div>

        <div
          className="relative flex items-center justify-center bg-white border-y border-slate-200 hover:bg-slate-50"
          style={{ height: splitterPx }}
          onMouseDown={onMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panels"
        >
          <div className="h-full w-full cursor-row-resize flex items-center justify-center">
            <div className="h-1.5 w-20 rounded-full bg-slate-300/80" />
          </div>
        </div>

        <div className="min-h-0 overflow-hidden">{bottom}</div>
      </div>
    </div>
  );
}
