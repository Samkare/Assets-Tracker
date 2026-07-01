// F5 Tech performance + F6 Supplier defective rate — read-only report panels.
import React from "react";
import { useTechPerformance, useSupplierPerformance } from "./api/hooks.js";

function fmtHours(h) { if (h == null) return "—"; if (h < 24) return Math.round(h * 10) / 10 + "h"; return Math.round(h / 24 * 10) / 10 + "d"; }

export function PerfPanels() {
  const { data: techs = [] } = useTechPerformance();
  const { data: sups = [] } = useSupplierPerformance();
  return (
    <div className="perf-grid">
      <section id="tech-performance" className="table-card inv-card-premium">
        <div className="drawer-section-title inv-card-title">Tech performance</div>
        {techs.length === 0 ? <div className="cell-muted" style={{ padding: "var(--sp-16)" }}>No repair tickets yet.</div> : (
          <div className="table-scroll"><table className="data-table">
            <thead><tr>
              <th><span className="th-plain">Technician</span></th>
              <th style={{ textAlign: "right" }}><span className="th-plain">Open</span></th>
              <th style={{ textAlign: "right" }}><span className="th-plain">Closed</span></th>
              <th style={{ textAlign: "right" }}><span className="th-plain">Avg time</span></th>
            </tr></thead>
            <tbody>{techs.map((t, i) => (
              <tr key={i}>
                <td>{t.tech}</td>
                <td style={{ textAlign: "right" }}><span className="mono">{t.open_count}</span></td>
                <td style={{ textAlign: "right" }}><span className="mono">{t.closed_count}</span></td>
                <td style={{ textAlign: "right" }} className="cell-muted">{fmtHours(t.avg_hours)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section id="supplier-performance" className="table-card inv-card-premium">
        <div className="drawer-section-title inv-card-title">Supplier defective rate</div>
        {sups.length === 0 ? <div className="cell-muted" style={{ padding: "var(--sp-16)" }}>No suppliers yet.</div> : (
          <div className="table-scroll"><table className="data-table">
            <thead><tr>
              <th><span className="th-plain">Supplier</span></th>
              <th style={{ textAlign: "right" }}><span className="th-plain">Received</span></th>
              <th style={{ textAlign: "right" }}><span className="th-plain">Defective</span></th>
              <th style={{ textAlign: "right" }}><span className="th-plain">Rate</span></th>
            </tr></thead>
            <tbody>{sups.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td style={{ textAlign: "right" }} className="mono">{s.received}</td>
                <td style={{ textAlign: "right" }} className="mono">{s.defective}</td>
                <td style={{ textAlign: "right" }}>
                  <span className="status-pill" data-s={s.defective_rate > 5 ? "open" : s.defective_rate > 0 ? "adjust" : "resolved"}>
                    {s.defective_rate != null ? s.defective_rate + "%" : "—"}
                  </span>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
