// Task Source — Inventory overview: "what we currently hold" across hardware, consumables, software.
import React, { useState } from "react";
import { Icon, ICONS, StatCard, PERIPHERALS } from "./components.jsx";
import { cpuFamily } from "./pages.jsx";
import { DetailModal, ASSET_COLS, CONSUMABLE_COLS } from "./DetailPopup.jsx";
import { useAssets, useConsumables, useSoftware, usePeripherals } from "./api/hooks.js";

function tally(list, keyFn) {
  const m = new Map();
  for (const x of list) { const k = keyFn(x) || "—"; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n);
}

function ramBucket(r) {
  if (!r) return "Unknown";
  const g = parseInt(String(r).replace(/[^0-9]/g, ""), 10);
  return g ? g + " GB" : "Unknown";
}
// normalize messy storage values: anything with multiple disks/separators → "Multi-disk"
function hddBucket(h) {
  if (!h) return "Unknown";
  const s = String(h).trim();
  if (/[&/+,]/.test(s) || (s.match(/\d+\s*(gb|tb)/gi) || []).length > 1) return "Multi-disk";
  return s;
}

// Single-accent horizontal bar list. Auto-hides when there's ≤1 row (a single full bar
// conveys nothing). Caps long lists and shows a "+N more" footer. `wide` spans 2 columns.
// Each row is a button → opens the drill-down popup with the matching machines.
function BarList({ title, items, keyFn, onSelect, wide = false, limit = 8 }) {
  const rows = tally(items, keyFn);
  if (rows.length <= 1) return null;
  const shown = rows.slice(0, limit);
  const hidden = rows.length - shown.length;
  const max = rows.reduce((m, r) => Math.max(m, r.n), 0) || 1;
  const open = (key) => onSelect({
    title: `${title} · ${key}`,
    subtitle: `${rows.find((r) => r.key === key)?.n || 0} machines`,
    columns: ASSET_COLS,
    rows: items.filter((i) => (keyFn(i) || "—") === key),
  });
  return (
    <div className={"table-card inv-card" + (wide ? " inv-card-wide" : "")}>
      <div className="drawer-section-title inv-card-title">{title}</div>
      <div className="inv-bars">
        {shown.map((r) => (
          <button type="button" key={r.key} className="inv-bar-row inv-bar-row-btn" onClick={() => open(r.key)}
            title={`${r.key} — click for ${r.n} machine${r.n === 1 ? "" : "s"}`}>
            <span className="inv-bar-label">{r.key}</span>
            <span className="inv-bar-track"><span className="inv-bar-fill" style={{ width: (r.n / max * 100) + "%" }} /></span>
            <span className="inv-bar-n">{r.n}</span>
          </button>
        ))}
        {hidden > 0 ? <div className="inv-bar-more">+{hidden} more</div> : null}
      </div>
    </div>
  );
}

// Software seat utilization — bar per license, red when full.
function SeatsWidget({ software, wide = false }) {
  if (!software.length) return null;
  return (
    <div className={"table-card inv-card" + (wide ? " inv-card-wide" : "")}>
      <div className="drawer-section-title inv-card-title">Software seats</div>
      <div className="inv-bars">
        {software.slice(0, 8).map((s) => {
          const total = s.seats_total || 0;
          const used = s.seatsUsed || 0;
          const pct = total ? Math.min(100, (used / total) * 100) : 0;
          const full = total > 0 && used >= total;
          return (
            <div key={s.id} className="inv-bar-row">
              <span className="inv-bar-label" title={s.name}>{s.name}</span>
              <span className="inv-bar-track"><span className="inv-bar-fill" style={full ? { width: pct + "%", background: "var(--danger)" } : { width: pct + "%" }} /></span>
              <span className="inv-bar-n">{used}/{total || "∞"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Peripheral adoption across the fleet — each machine can have several, so this counts
// "how many machines have X". Standard 7 + any custom peripherals. Each row drills in.
function PeripheralBars({ items, customPeriphs, onSelect, wide = false }) {
  const rows = [
    ...PERIPHERALS.map((p) => ({ key: p.key, label: p.label, n: items.filter((a) => a[p.key]).length, has: (a) => !!a[p.key] })),
    ...customPeriphs.map((cp) => ({ key: "c-" + cp.key, label: cp.label, n: items.filter((a) => (a.customPeripherals || []).includes(cp.key)).length, has: (a) => (a.customPeripherals || []).includes(cp.key) })),
  ].filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
  if (!rows.length) return null;
  const max = rows.reduce((m, r) => Math.max(m, r.n), 0) || 1;
  return (
    <div className={"table-card inv-card" + (wide ? " inv-card-wide" : "")}>
      <div className="drawer-section-title inv-card-title">By peripheral</div>
      <div className="inv-bars">
        {rows.map((r) => (
          <button type="button" key={r.key} className="inv-bar-row inv-bar-row-btn"
            onClick={() => onSelect({ title: `Has ${r.label}`, subtitle: `${r.n} machine${r.n === 1 ? "" : "s"}`, columns: ASSET_COLS, rows: items.filter(r.has) })}
            title={`${r.label} — ${r.n} machine${r.n === 1 ? "" : "s"}`}>
            <span className="inv-bar-label">{r.label}</span>
            <span className="inv-bar-track"><span className="inv-bar-fill" style={{ width: (r.n / max * 100) + "%" }} /></span>
            <span className="inv-bar-n">{r.n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function InventoryPage() {
  const { data: assets = [] } = useAssets({ includeRetired: 1 });
  const { data: consumables = [] } = useConsumables();
  const { data: customPeriphs = [] } = usePeripherals();
  const { data: software = [] } = useSoftware();

  const [detail, setDetail] = useState(null);
  const active = assets.filter((a) => a.status !== "retired");
  const desktops = active.filter((a) => a.type === "Desktop").length;
  const laptops = active.filter((a) => a.type === "Laptop").length;
  const inRepair = assets.filter((a) => a.status === "repair").length;
  const spares = assets.filter((a) => a.inStock).length;

  // KPI drill-downs → asset list popup
  const showAssets = (title, list) => setDetail({ title, subtitle: `${list.length} machine${list.length === 1 ? "" : "s"}`, columns: ASSET_COLS, rows: list });
  const showConsumables = () => setDetail({ title: "Consumable lines", subtitle: `${consumables.length} item${consumables.length === 1 ? "" : "s"}`, columns: CONSUMABLE_COLS, rows: consumables });

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Stock Overview</h1>
        <p className="page-caption">Browse counts — aggregate hardware, consumables &amp; licenses on hand</p>
      </div>

      <div className="stats">
        <StatCard label="Machines in Service" value={active.length} sub={`${desktops} desktop · ${laptops} laptop`} icon={ICONS.assets} ring={240} onClick={() => showAssets("Machines in service", active)} />
        <StatCard label="Spares in Store" value={spares} sub="ready to deploy" icon={ICONS.assets} ring={150} onClick={() => showAssets("Spares in store", assets.filter((a) => a.inStock))} />
        <StatCard label="In Repair" value={inRepair} sub="out of service" icon={ICONS.wrench} ring={12} onClick={() => showAssets("In repair", assets.filter((a) => a.status === "repair"))} />
        <StatCard label="Consumable Lines" value={consumables.length} sub={`${consumables.filter((c) => c.low).length} low on stock`} accent icon={ICONS.hdd} ring={168} onClick={showConsumables} />
      </div>

      <div className="inv-grid">
        {/* By type / By status are single-value here → BarList auto-hides them */}
        <BarList title="By processor" items={active} keyFn={(a) => cpuFamily(a.cpu)} onSelect={setDetail} />
        <BarList title="By memory (RAM)" items={active} keyFn={(a) => ramBucket(a.ram)} onSelect={setDetail} />
        <BarList title="By storage" items={active} keyFn={(a) => hddBucket(a.hdd)} onSelect={setDetail} />
        <BarList title="By monitors" items={active} keyFn={(a) => (!a.monitors || a.monitors === "—") ? "Not recorded" : a.monitors} onSelect={setDetail} />
        <SeatsWidget software={software} wide />
        <BarList title="By department" items={active} keyFn={(a) => a.dept} onSelect={setDetail} wide limit={10} />
        <PeripheralBars items={active} customPeriphs={customPeriphs} onSelect={setDetail} wide />
      </div>

      <DetailModal data={detail} onClose={() => setDetail(null)} />

      <div className="table-card inv-card inv-block">
        <div className="drawer-section-title inv-card-title">Consumables on hand</div>
        {consumables.length === 0 ? <span className="cell-muted">No consumables tracked yet.</span> : (
          <div className="table-scroll">
            <table className="data-table"><thead><tr>
              <th><span className="th-plain">Item</span></th><th><span className="th-plain">Category</span></th>
              <th><span className="th-plain">On hand</span></th><th><span className="th-plain">Reorder at</span></th>
            </tr></thead><tbody>
              {consumables.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}{c.low ? <span className="sw-badge inv-low">Low</span> : null}</td>
                  <td className="cell-muted">{c.category || "—"}</td>
                  <td><span className="mono">{c.qty}</span> {c.unit || ""}</td>
                  <td className="cell-muted">{c.reorder_level}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        )}
      </div>

      <div className="table-card inv-card inv-block">
        <div className="drawer-section-title inv-card-title">Software licenses</div>
        {software.length === 0 ? <span className="cell-muted">No software tracked yet.</span> : (
          <div className="table-scroll">
            <table className="data-table"><thead><tr>
              <th><span className="th-plain">Name</span></th><th><span className="th-plain">Vendor</span></th>
              <th><span className="th-plain">Seats</span></th><th><span className="th-plain">Status</span></th>
            </tr></thead><tbody>
              {software.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="cell-muted">{s.vendor || "—"}</td>
                  <td><span className="mono">{s.seatsUsed} / {s.seats_total}</span></td>
                  <td><span className={"sw-status" + (s.status === "expired" ? " sw-status-expired" : "")}>{s.status}</span></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        )}
      </div>
    </React.Fragment>
  );
}
