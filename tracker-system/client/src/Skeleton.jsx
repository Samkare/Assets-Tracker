// Skeleton loaders — replace bare "Loading…" strings with content-shaped placeholders.
import React, { useEffect, useState } from "react";

// Delay-show: render nothing for first N ms so fast queries don't flash a skeleton.
export function useDelayedFlag(flag, delay = 150) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!flag) { setShow(false); return; }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [flag, delay]);
  return show;
}

const Bar = ({ w = "100%", h = 12, r = 6, style }) => (
  <span aria-hidden="true" className="sk-bar" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

export function SkeletonStat() {
  return (
    <div className="stat-card" role="status" aria-busy="true" aria-label="Loading">
      <div className="stat-top"><Bar w="50%" h={11} /><Bar w={22} h={22} r="50%" /></div>
      <Bar w="40%" h={28} style={{ marginTop: 12 }} />
      <Bar w="60%" h={10} style={{ marginTop: 8 }} />
    </div>
  );
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <tr aria-busy="true" aria-label="Loading">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i}><Bar w={i === 0 ? "70%" : i === cols - 1 ? "40%" : "60%"} /></td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
  return (
    <table className="data-table" role="status" aria-busy="true" aria-label="Loading rows">
      <tbody>{Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} cols={cols} />)}</tbody>
    </table>
  );
}

export function SkeletonCard() {
  return (
    <div className="sw-card" role="status" aria-busy="true" aria-label="Loading">
      <Bar w="60%" h={16} />
      <Bar w="40%" h={11} style={{ marginTop: 8 }} />
      <Bar w="100%" h={8} r={999} style={{ marginTop: 18 }} />
      <Bar w="80%" h={10} style={{ marginTop: 14 }} />
    </div>
  );
}

export function SkeletonTimeline({ items = 4 }) {
  return (
    <div className="drawer-timeline" role="status" aria-busy="true" aria-label="Loading history">
      {Array.from({ length: items }, (_, i) => (
        <div className="drawer-tl-row" key={i}>
          <Bar w={26} h={26} r="50%" />
          <div className="drawer-tl-body">
            <Bar w="50%" h={12} />
            <Bar w="80%" h={10} style={{ marginTop: 6 }} />
          </div>
          <Bar w={50} h={10} />
        </div>
      ))}
    </div>
  );
}
