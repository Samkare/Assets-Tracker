// Shared drill-down popup — used by Stock Overview and Reports.
// A widget click passes { title, subtitle, columns, rows }; the modal renders a table.
import React from "react";
import { Icon, ICONS } from "./components.jsx";
import { useFocusTrap } from "./useFocusTrap.js";

// column set for an asset/machine list
export const ASSET_COLS = [
  { label: "Tag", render: (a) => <span className="mono">{a.id}</span> },
  { label: "User", render: (a) => (a.shared ? "Shared" : a.pseudo) },
  { label: "Dept", render: (a) => <span className="cell-muted">{a.dept}</span> },
  { label: "Type", render: (a) => <span className="cell-muted">{a.type}</span> },
  { label: "CPU", render: (a) => <span className="cell-muted">{a.cpu || "—"}</span> },
  { label: "RAM", render: (a) => <span className="cell-muted">{a.ram || "—"}</span> },
];

export const CONSUMABLE_COLS = [
  { label: "Item", render: (c) => c.name },
  { label: "Category", render: (c) => <span className="cell-muted">{c.category || "—"}</span> },
  { label: "On hand", render: (c) => <span className="mono">{c.qty} {c.unit || ""}</span> },
  { label: "Reorder at", render: (c) => <span className="cell-muted">{c.reorder_level}</span> },
];

export function DetailModal({ data, onClose }) {
  const ref = React.useRef(null);
  useFocusTrap(ref, !!data);
  React.useEffect(() => {
    if (!data) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [data, onClose]);
  if (!data) return null;
  const { title, subtitle, columns, rows } = data;
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <div className="modal modal-detail" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            <div className="modal-subtitle">{subtitle}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>
        <div className="modal-body">
          {rows.length === 0 ? <span className="cell-muted">Nothing to show here.</span> : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr>{columns.map((c) => <th key={c.label}><span className="th-plain">{c.label}</span></th>)}</tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id || i}>{columns.map((c) => <td key={c.label}>{c.render(r)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
