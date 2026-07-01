// Main app: sidebar, topbar, dashboard (stats + filterable/sortable table), routing between views

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#5E5CE6",
  "density": "regular",
  "striping": true
}/*EDITMODE-END*/;

const PAGE_SIZE = 25;

const COLUMNS = [
  { key: 'name', label: 'Employee Name' },
  { key: 'dept', label: 'Department' },
  { key: 'type', label: 'Equipment Type' },
  { key: 'tag', label: 'Model / Asset ID' },
  { key: 'sn1', label: 'Serial Number' },
  { key: 'date', label: 'Assigned Date' },
  { key: 'status', label: 'Status' },
];

function compareAssets(a, b, key) {
  const av = a[key], bv = b[key];
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  if (key === 'tag') {
    const an = parseInt((av.match(/(\d+)$/) || [])[1] || '0', 10);
    const bn = parseInt((bv.match(/(\d+)$/) || [])[1] || '0', 10);
    if (an !== bn) return an - bn;
  }
  return String(av).localeCompare(String(bv));
}

function Sidebar({ nav, setNav, counts }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: Icon.dashboard },
    { id: 'employees', label: 'Employees', icon: Icon.people },
    { id: 'equipment', label: 'Equipment', icon: Icon.monitor },
    { id: 'reports', label: 'Reports', icon: Icon.chart },
  ];
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">IT</span>
        <span className="brand-name">Asset Tracker</span>
      </div>
      <div className="sidebar-items">
        {items.map((it) => (
          <button type="button" key={it.id} className={'side-item' + (nav === it.id ? ' side-item-on' : '')} onClick={() => setNav(it.id)}>
            <it.icon />
            <span>{it.label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-foot">
        <div className="sidebar-foot-line">{counts.total} assets · {counts.employees} people</div>
      </div>
    </nav>
  );
}

function DashboardView({ assets, query, onOpenAsset, counts }) {
  const [filters, setFilters] = React.useState({ dept: 'All', type: 'All', status: 'All' });
  const [sort, setSort] = React.useState({ key: null, dir: 1 });
  const [page, setPage] = React.useState(0);

  const departments = React.useMemo(() => [...new Set(assets.map((a) => a.dept))].sort(), [assets]);
  const types = React.useMemo(() => [...new Set(assets.map((a) => a.type))].sort(), [assets]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = assets.filter((a) => {
      if (filters.dept !== 'All' && a.dept !== filters.dept) return false;
      if (filters.type !== 'All' && a.type !== filters.type) return false;
      if (filters.status !== 'All' && a.status !== filters.status) return false;
      if (q) {
        const hay = [a.name, a.dept, a.type, a.tag, a.sn1, a.sn2, a.cpu, a.status].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (sort.key) rows = [...rows].sort((a, b) => compareAssets(a, b, sort.key) * sort.dir);
    return rows;
  }, [assets, filters, sort, query]);

  React.useEffect(() => { setPage(0); }, [filters, query, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageClamped = Math.min(page, pages - 1);
  const visible = filtered.slice(pageClamped * PAGE_SIZE, pageClamped * PAGE_SIZE + PAGE_SIZE);
  const anyFilter = filters.dept !== 'All' || filters.type !== 'All' || filters.status !== 'All' || query.trim();

  const toggleSort = (key) => {
    setSort((s) => s.key === key ? (s.dir === 1 ? { key, dir: -1 } : { key: null, dir: 1 }) : { key, dir: 1 });
  };

  return (
    <div data-screen-label="Dashboard">
      <div className="view-head">
        <h1 className="view-title">Dashboard</h1>
        <span className="view-count">Equipment assignments at a glance</span>
      </div>

      <div className="stats-grid">
        <StatCard label="Total Assets" value={counts.total} sub="across all departments" />
        <StatCard label="Assigned" value={counts.assigned} sub={Math.round((counts.assigned / counts.total) * 100) + '% of inventory'} />
        <StatCard label="Available" value={counts.available} sub={counts.repair + ' in repair'} />
        <StatCard label="Employees" value={counts.employees} sub="with equipment issued" />
      </div>

      <div className="toolbar">
        <Dropdown label="Department" value={filters.dept} options={departments} onChange={(v) => setFilters({ ...filters, dept: v })} />
        <Dropdown label="Equipment Type" value={filters.type} options={types} onChange={(v) => setFilters({ ...filters, type: v })} />
        <Dropdown label="Status" value={filters.status} options={['Assigned', 'Available', 'In Repair']} onChange={(v) => setFilters({ ...filters, status: v })} />
        {anyFilter ? (
          <span className="toolbar-result">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</span>
        ) : null}
      </div>

      <div className="card">
        <table className="table table-main">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} onClick={() => toggleSort(c.key)} className={'th-sortable' + (sort.key === c.key ? ' th-on' : '')}>
                  <span className="th-inner">
                    {c.label}
                    <span className={'sort-arrow' + (sort.key === c.key ? ' sort-arrow-on' : '') + (sort.key === c.key && sort.dir === -1 ? ' sort-arrow-desc' : '')}>
                      <Icon.arrowUp />
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => (
              <tr key={a.id} onClick={() => onOpenAsset(a.id)}>
                <td>
                  {a.name ? (
                    <span className="cell-person"><Avatar name={a.name} /> <span className="cell-name">{a.name}</span></span>
                  ) : (
                    <span className="cell-unassigned">— Unassigned</span>
                  )}
                </td>
                <td className="cell-muted">{a.dept}</td>
                <td className="cell-muted">{a.type}</td>
                <td>
                  <div className="cell-model">
                    <span className="mono cell-tag">{a.tag}</span>
                    {a.cpu ? <span className="cell-spec">{[a.cpu, a.ram].filter(Boolean).join(' · ')}</span> : null}
                  </div>
                </td>
                <td className="mono cell-serial">{a.sn1 || '—'}</td>
                <td className="cell-muted cell-date">{fmtDate(a.date)}</td>
                <td><StatusPill status={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 ? (
          <EmptyState
            title="No assets match"
            sub="Try clearing the search or filters."
            action={<button type="button" className="btn btn-secondary" onClick={() => setFilters({ dept: 'All', type: 'All', status: 'All' })}>Clear filters</button>}
          />
        ) : (
          <footer className="table-foot">
            <span className="table-foot-count">
              {pageClamped * PAGE_SIZE + 1}–{Math.min((pageClamped + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <span className="table-foot-pager">
              <button type="button" className="pager-btn" disabled={pageClamped === 0} onClick={() => setPage(pageClamped - 1)}>Previous</button>
              <span className="pager-page">Page {pageClamped + 1} of {pages}</span>
              <button type="button" className="pager-btn" disabled={pageClamped >= pages - 1} onClick={() => setPage(pageClamped + 1)}>Next</button>
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [assets, setAssets] = React.useState(() => window.ASSET_SEED_DATA);
  const [nav, setNav] = React.useState('dashboard');
  const [query, setQuery] = React.useState('');
  const [selectedId, setSelectedId] = React.useState(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);

  const counts = React.useMemo(() => ({
    total: assets.length,
    assigned: assets.filter((a) => a.status === 'Assigned').length,
    available: assets.filter((a) => a.status === 'Available').length,
    repair: assets.filter((a) => a.status === 'In Repair').length,
    employees: new Set(assets.filter((a) => a.name && a.name !== 'Day Shift (Shared)').map((a) => a.name + '|' + a.dept)).size,
  }), [assets]);

  const departments = React.useMemo(() => [...new Set(assets.map((a) => a.dept))].sort(), [assets]);
  const existingTags = React.useMemo(() => new Set(assets.map((a) => a.tag.toUpperCase())), [assets]);
  const selected = assets.find((a) => a.id === selectedId) || null;

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 3200);
  };

  const updateAsset = (id, patch) => {
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a));
  };

  const addAssignment = (form) => {
    const rec = {
      id: 'N' + Date.now(),
      tag: form.tag, name: form.name, dept: form.dept, type: form.type,
      cpu: null, ram: null, hdd: null, sn1: form.serial, sn2: null,
      periph: {}, status: 'Assigned', date: form.date,
    };
    setAssets((prev) => [rec, ...prev]);
    setModalOpen(false);
    setNav('dashboard');
    showToast(form.tag + ' assigned to ' + form.name);
  };

  return (
    <div className="app" style={{ '--accent': t.accent, '--row-pad': t.density === 'compact' ? '7px' : '11px' }} data-striping={t.striping ? 'on' : 'off'}>
      <Sidebar nav={nav} setNav={setNav} counts={counts} />

      <div className="main">
        <header className="topbar">
          <div className="search search-top">
            <Icon.search className="search-icon" />
            <input className="search-input" placeholder="Search employees, assets, serials…" value={query}
              onChange={(e) => { setQuery(e.target.value); if (nav !== 'dashboard') setNav('dashboard'); }} />
            {query ? <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Clear search"><Icon.x /></button> : null}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}><Icon.plus /> Assign Equipment</button>
        </header>

        <main className="content">
          {nav === 'dashboard' ? <DashboardView assets={assets} query={query} counts={counts} onOpenAsset={setSelectedId} /> : null}
          {nav === 'employees' ? <EmployeesView assets={assets} onOpenAsset={setSelectedId} /> : null}
          {nav === 'equipment' ? <EquipmentView assets={assets} /> : null}
          {nav === 'reports' ? <ReportsView assets={assets} /> : null}
        </main>
      </div>

      <AssetDrawer asset={selected} onClose={() => setSelectedId(null)} onUpdate={updateAsset} />
      <AssignModal open={modalOpen} departments={departments} existingTags={existingTags} onClose={() => setModalOpen(false)} onSubmit={addAssignment} />

      {toast ? <div className="toast">{toast}</div> : null}

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.accent} options={['#5E5CE6', '#2A6FDB', '#1F8A5B', '#C2543A']} onChange={(v) => setTweak('accent', v)} />
        <TweakSection label="Table" />
        <TweakRadio label="Density" value={t.density} options={['regular', 'compact']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Row striping" value={t.striping} onChange={(v) => setTweak('striping', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
