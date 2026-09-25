import { useEffect, useState } from "react";
import { animate } from "framer-motion";
import { scoreLabel } from "../../shared/ats";

const TONE = { great: "#18b26b", good: "#ffd43b", fair: "#ff9f1c", low: "#e5383b" };

/** A chunky ring gauge that counts up to its value. */
export function Gauge({ value, size = 132, stroke = 14, label = false }: { value: number; size?: number; stroke?: number; label?: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const c = animate(shown, value, { duration: 0.9, ease: [0.2, 0.9, 0.25, 1], onUpdate: (v) => setShown(v) });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const r = (size - stroke) / 2 - 2;
  const C = 2 * Math.PI * r;
  const { label: text, tone } = scoreLabel(value);
  const color = TONE[tone];
  return (
    <div className="gauge" style={{ width: size, height: size }} role="img" aria-label={`Score ${value} out of 100: ${text}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="#fff" stroke="#0e0e0e" strokeWidth={stroke + 4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eceef2" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${(C * shown) / 100} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} strokeLinecap="butt" />
        {Array.from({ length: 20 }, (_, i) => {
          const a = (i / 20) * 2 * Math.PI - Math.PI / 2;
          const x1 = size / 2 + Math.cos(a) * (r - stroke / 2), y1 = size / 2 + Math.sin(a) * (r - stroke / 2);
          const x2 = size / 2 + Math.cos(a) * (r + stroke / 2), y2 = size / 2 + Math.sin(a) * (r + stroke / 2);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth={size > 80 ? 2.5 : 1.5} />;
        })}
      </svg>
      {size > 80 ? (
        <div className="gauge__num"><div><b>{Math.round(shown)}</b><small>{label ? text.toUpperCase() : "/ 100"}</small></div></div>
      ) : (
        <div className="gauge__num"><b style={{ fontSize: size * 0.34 }}>{Math.round(shown)}</b></div>
      )}
    </div>
  );
}
