// Task Source — Dashboard trends (lightweight CSS charts, no chart library)
import React from "react";
import { useTrends } from "./api/hooks.js";

function monthLabel(ym) {
  if (!ym) return "";
  const m = String(ym).split("-")[1];
  return m || ym;
}

/* vertical bar chart — series: [{label,value}], scaled to the series max */
function VBarChart({ title, series, color, format }) {
  const peak = Math.max(1, ...series.map((s) => s.value));
  return (
    <div className="table-card trend-card">
      <div className="trend-title">{title}</div>
      {series.length === 0 ? (
        <div className="trend-empty">No data yet</div>
      ) : (
        <div className="trend-vbars">
          {series.map((s, i) => (
            <div className="trend-vbar-col" key={s.label + "-" + i}>
              <div className="trend-vbar-track">
                <div className="trend-vbar-fill"
                  style={{ height: Math.max((s.value / peak) * 100, 2) + "%", background: color }}
                  title={(format ? format(s.value) : s.value) + ""}></div>
              </div>
              <div className="trend-vbar-val">{format ? format(s.value) : s.value}</div>
              <div className="trend-vbar-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* horizontal bar chart — series: [{label,value}] */
function HBarChart({ title, series, color }) {
  const peak = Math.max(1, ...series.map((s) => s.value));
  return (
    <div className="table-card trend-card">
      <div className="trend-title">{title}</div>
      {series.length === 0 ? (
        <div className="trend-empty">No data yet</div>
      ) : (
        <div className="trend-hbars">
          {series.map((s, i) => (
            <div className="trend-hbar-row" key={s.label + "-" + i}>
              <span className="trend-hbar-label">{s.label}</span>
              <div className="trend-hbar-track">
                <div className="trend-hbar-fill"
                  style={{ width: Math.max((s.value / peak) * 100, 2) + "%", background: color }}></div>
              </div>
              <span className="trend-hbar-val">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendsCharts() {
  const { data } = useTrends();
  const t = data || {};
  const assets = (t.assetsByMonth || []).map((r) => ({ label: monthLabel(r.month), value: r.n }));
  const repairs = (t.repairsByMonth || []).map((r) => ({ label: monthLabel(r.month), value: r.n }));

  return (
    <div id="trends" className="trend-grid">
      <VBarChart title="Assets added by month" series={assets} color="var(--accent)" />
      <VBarChart title="Repairs by month" series={repairs} color="var(--repair)" />
    </div>
  );
}

export { TrendsCharts };
