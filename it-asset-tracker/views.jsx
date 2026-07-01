// Secondary views: Employees, Equipment, Reports — all derived from the same dataset

function EmployeesView({ assets, onOpenAsset }) {
  const [q, setQ] = React.useState('');
  const employees = React.useMemo(() => {
    const map = new Map();
    for (const a of assets) {
      if (!a.name || a.name === 'Day Shift (Shared)') continue;
      const key = a.name + '|' + a.dept;
      if (!map.has(key)) map.set(key, { name: a.name, dept: a.dept, items: [] });
      map.get(key).items.push(a);
    }
    return [...map.values()].sort((x, y) => x.name.localeCompare(y.name));
  }, [assets]);
  const filtered = employees.filter((e) => (e.name + ' ' + e.dept).toLowerCase().includes(q.toLowerCase()));
  return (
    <div data-screen-label="Employees view">
      <div className="view-head">
        <h1 className="view-title">Employees</h1>
        <span className="view-count">{employees.length} people with equipment</span>
      </div>
      <div className="toolbar">
        <div className="search">
          <Icon.search className="search-icon" />
          <input className="search-input" placeholder="Search employees…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Employee</th><th>Department</th><th>Equipment</th></tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.name + e.dept} className="row-static">
                <td><span className="cell-person"><Avatar name={e.name} /> <span className="cell-name">{e.name}</span></span></td>
                <td className="cell-muted">{e.dept}</td>
                <td>
                  <span className="tag-list">
                    {e.items.map((a) => (
                      <button type="button" key={a.id} className="tag-chip mono" onClick={() => onOpenAsset(a.id)}>{a.tag}</button>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? <EmptyState title="No employees match" sub={'Nothing matches "' + q + '"'} /> : null}
      </div>
    </div>
  );
}

function BreakdownCard({ title, rows, total, accent }) {
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <div className="card breakdown-card">
      <h3 className="breakdown-title">{title}</h3>
      <div className="breakdown-rows">
        {rows.map(([label, count]) => (
          <div key={label} className="breakdown-row">
            <span className="breakdown-label">{label}</span>
            <span className="breakdown-bar-track">
              <span className="breakdown-bar" style={{ width: (count / max) * 100 + '%', background: accent || 'var(--accent)' }}></span>
            </span>
            <span className="breakdown-count">{count}</span>
          </div>
        ))}
      </div>
      {total != null ? <div className="breakdown-total">{total} total</div> : null}
    </div>
  );
}

function tally(assets, fn) {
  const m = new Map();
  for (const a of assets) { const k = fn(a); if (!k) continue; m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((x, y) => y[1] - x[1]);
}

function EquipmentView({ assets }) {
  return (
    <div data-screen-label="Equipment view">
      <div className="view-head">
        <h1 className="view-title">Equipment</h1>
        <span className="view-count">{assets.length} devices in inventory</span>
      </div>
      <div className="breakdown-grid">
        <BreakdownCard title="By type" rows={tally(assets, (a) => a.type)} />
        <BreakdownCard title="By processor" rows={tally(assets, (a) => a.cpu)} />
        <BreakdownCard title="By memory" rows={tally(assets, (a) => a.ram)} />
        <BreakdownCard title="By storage" rows={tally(assets, (a) => a.hdd)} />
      </div>
      <p className="view-note">Specification data is recorded for {assets.filter((a) => a.cpu).length} of {assets.length} devices — the rest haven't been audited yet.</p>
    </div>
  );
}

function ReportsView({ assets }) {
  const byDept = tally(assets.filter((a) => a.dept !== 'IT Stock'), (a) => a.dept);
  const byStatus = tally(assets, (a) => a.status);
  const statusColor = { Assigned: 'var(--green)', Available: 'var(--gray)', 'In Repair': 'var(--amber)' };
  return (
    <div data-screen-label="Reports view">
      <div className="view-head">
        <h1 className="view-title">Reports</h1>
        <span className="view-count">Inventory distribution</span>
      </div>
      <div className="breakdown-grid">
        <BreakdownCard title="Assets by department" rows={byDept} total={assets.length} />
        <div className="card breakdown-card">
          <h3 className="breakdown-title">By status</h3>
          <div className="status-split">
            {byStatus.map(([label, count]) => (
              <div key={label} className="status-split-row">
                <span className="status-split-dot" style={{ background: statusColor[label] }}></span>
                <span className="status-split-label">{label}</span>
                <span className="status-split-count">{count}</span>
                <span className="status-split-pct">{Math.round((count / assets.length) * 100)}%</span>
              </div>
            ))}
          </div>
          <div className="status-stack">
            {byStatus.map(([label, count]) => (
              <span key={label} style={{ width: (count / assets.length) * 100 + '%', background: statusColor[label] }}></span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, sub, action }) {
  return (
    <div className="empty">
      <div className="empty-glyph"><Icon.search width="20" height="20" /></div>
      <div className="empty-title">{title}</div>
      <div className="empty-sub">{sub}</div>
      {action || null}
    </div>
  );
}

Object.assign(window, { EmployeesView, EquipmentView, ReportsView, EmptyState, BreakdownCard });
