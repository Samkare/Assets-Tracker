// Task Source — IT Asset Tracker · main app
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#475569",
  "zebra": true,
  "tilt3d": true
} /*EDITMODE-END*/;

function sortVal(a, key) {
  if (key === "monitors") return { "Dual": 0, "Single": 1, "—": 2 }[a.monitors];
  if (key === "pseudo") return a.shared ? "\uffff" : a.pseudo.toLowerCase();
  const v = a[key];
  if (v == null || v === "") return "\uffff";
  return v.toString().toLowerCase();
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const isMobile = useIsMobile(860);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState(() => {
    try {const s = localStorage.getItem("ts_currentUser");return s ? JSON.parse(s) : null;} catch (e) {return null;}
  });
  const searchRef = React.useRef(null);
  const [assets, setAssets] = React.useState(window.ASSETS);
  const [log, setLog] = React.useState(window.AUDIT_SEED);
  const [page, setPage] = React.useState("Dashboard");
  const [query, setQuery] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("All");
  const [typeFilter, setTypeFilter] = React.useState("All");
  const [sort, setSort] = React.useState({ key: "pseudo", dir: 1 });
  const [selected, setSelected] = React.useState(null);
  const [selectedKey, setSelectedKey] = React.useState(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState("assign");
  const [editing, setEditing] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);

  const showToast = (msg) => {
    setToast(msg);clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();searchRef.current && searchRef.current.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // 3D card tilt — follows the cursor across .tilt-3d cards
  React.useEffect(() => {
    if (!t.tilt3d) return;
    let current = null;
    const reset = (el) => {if (el) {el.style.setProperty("--rx", "0deg");el.style.setProperty("--ry", "0deg");el.style.removeProperty("--tz");}};
    const onMove = (e) => {
      const card = e.target.closest && e.target.closest(".tilt-3d");
      if (card !== current) {reset(current);current = card;}
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      const max = 5.5;
      card.style.setProperty("--rx", (px * max).toFixed(2) + "deg");
      card.style.setProperty("--ry", (-py * max).toFixed(2) + "deg");
      card.style.setProperty("--tz", "6px");
    };
    const onLeaveDoc = () => {reset(current);current = null;};
    document.addEventListener("pointermove", onMove);
    window.addEventListener("blur", onLeaveDoc);
    return () => {reset(current);document.removeEventListener("pointermove", onMove);window.removeEventListener("blur", onLeaveDoc);};
  }, [t.tilt3d, page]);

  const pushLog = (action, a, detail) => {
    setLog((l) => [{
      ts: new Date().toISOString(), actor: currentUser ? currentUser.name : "Santosh", action,
      tag: a.id, subject: a.shared ? "Day-Shift PC" : a.pseudo, dept: a.dept, detail
    }, ...l]);
  };

  const login = (u) => {setCurrentUser(u);try {localStorage.setItem("ts_currentUser", JSON.stringify(u));} catch (e) {}};
  const logout = () => {setCurrentUser(null);try {localStorage.removeItem("ts_currentUser");} catch (e) {}setSidebarOpen(false);};

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = assets.filter((a) => {
      if (deptFilter !== "All" && a.dept !== deptFilter) return false;
      if (typeFilter !== "All" && a.type !== typeFilter) return false;
      if (q) {
        const hay = [a.pseudo, a.id, a.dept, a.cpu, a.ram].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    rows.sort((x, y) => {
      const a = sortVal(x, sort.key),b = sortVal(y, sort.key);
      if (a < b) return -1 * sort.dir;
      if (a > b) return 1 * sort.dir;
      return 0;
    });
    return rows;
  }, [assets, query, deptFilter, typeFilter, sort]);

  const stats = React.useMemo(() => {
    const assigned = assets.filter((a) => !a.shared).length;
    const employees = new Set(assets.filter((a) => !a.shared).map((a) => a.pseudo)).size;
    const depts = new Set(assets.map((a) => a.dept)).size;
    const coverage = coverageOf(assets);
    return { assigned, employees, depts, coverage };
  }, [assets]);

  const toggleSort = (key) => setSort((s) => s.key === key ? { key, dir: -s.dir } : { key, dir: 1 });
  const clearAll = () => {setQuery("");setDeptFilter("All");setTypeFilter("All");};
  const anyFilter = query.trim() || deptFilter !== "All" || typeFilter !== "All";

  const navTo = (p) => {
    setPage(p);
    if (p === "Assets") setSort({ key: "id", dir: 1 });else
    if (p === "Employees" || p === "Dashboard") setSort({ key: "pseudo", dir: 1 });
  };

  const handleSelect = (a, i) => {setSelected(a);setSelectedKey(a.id + "-" + i);};
  const closeDrawer = () => {setSelected(null);setSelectedKey(null);};

  const openCreate = (mode) => {setEditing(null);setModalMode(mode);setModalOpen(true);};
  const openEdit = (a) => {setEditing(a);setModalMode("edit");setModalOpen(true);closeDrawer();};

  const buildFields = (form) => {
    const shared = !form.pseudo.trim() || /day-?shift/i.test(form.pseudo);
    return {
      id: form.id.trim(), pseudo: shared ? "Day-Shift PC" : form.pseudo.trim(), shared, dept: form.dept,
      type: form.type, cpu: form.cpu.trim() || null, ram: form.ram.trim() || null, hdd: form.hdd.trim() || null,
      mon1: form.mon1.trim() || null, mon2: form.mon2.trim() || null,
      monitors: form.mon1.trim() && form.mon2.trim() ? "Dual" : form.mon1.trim() || form.mon2.trim() ? "Single" : "—",
      headphone: form.headphone, speaker: form.speaker, ipPhone: form.ipPhone,
      webcam: form.webcam, mobileStand: form.mobileStand
    };
  };

  const handleSubmit = (form) => {
    const fields = buildFields(form);
    if (editing) {
      const updated = { ...editing, ...fields };
      const changes = [];
      [["dept", "Department"], ["type", "Type"], ["cpu", "CPU"], ["ram", "RAM"], ["hdd", "Storage"], ["monitors", "Monitors"], ["pseudo", "Employee"]].
      forEach(([k, lbl]) => {if ((editing[k] || "—") !== (updated[k] || "—")) changes.push(`${lbl} ${editing[k] || "—"} → ${updated[k] || "—"}`);});
      PERIPHERALS.forEach((p) => {if (!!editing[p.key] !== !!updated[p.key]) changes.push(`${p.label} ${updated[p.key] ? "added" : "removed"}`);});
      setAssets((rows) => rows.map((r) => r === editing ? updated : r));
      pushLog("edited", updated, changes.length ? changes.slice(0, 3).join(" · ") : "Record saved (no field changes)");
      setModalOpen(false);setEditing(null);
      showToast(`${updated.id} updated`);
    } else {
      const rec = { ...fields, whatsapp: false, nextiva: false };
      setAssets((rows) => [rec, ...rows]);
      pushLog(rec.shared ? "added" : "assigned", rec, rec.shared ? "New machine registered to inventory" : `Assigned to ${rec.pseudo} · ${rec.dept}`);
      setModalOpen(false);
      showToast(`${rec.id} ${rec.shared ? "added" : "assigned to " + rec.pseudo}`);
    }
  };

  const handleRemove = (a) => {
    setAssets((rows) => rows.filter((r) => r !== a));
    pushLog("removed", a, "Removed from the register");
    closeDrawer();
    showToast(`${a.id} removed`);
  };

  const openDeptFilter = (d) => {setDeptFilter(d);navTo("Assets");};

  const previewRows = filtered.slice(0, 7);

  if (!currentUser) {
    return (
      <div className={"app" + (t.tilt3d ? " tilt-on" : "")} style={{ "--accent": t.accent }}>
        <LoginScreen users={window.USERS} onLogin={login} />
      </div>);

  }

  return (
    <div className={"app" + (t.zebra ? " zebra" : "") + (t.tilt3d ? " tilt-on" : "")} style={{ "--accent": t.accent }}>
      <header className="topbar">
        <button type="button" className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <Icon d={ICONS.menu} size={18} />
        </button>
        <div className="topbar-title"><img className="topbar-logo" src={(window.__resources && window.__resources.logo) || "logo.png"} alt="Task Source — IT Asset Tracker" /></div>
        <div className="topbar-search">
          <Icon d={ICONS.search} size={15} />
          <input ref={searchRef} className="search-input" placeholder="Search by employee or asset tag…"
          value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
          {query ?
          <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <Icon d={ICONS.close} size={12} />
            </button> :
          <kbd className="kbd-hint">⌘K</kbd>}
        </div>
        <div className="topbar-actions">
          <button type="button" className="topbar-util" onClick={() => navTo("Audit Log")} aria-label="Activity log">
            <Icon d={ICONS.bell} size={17} />
            <span className="util-dot"></span>
          </button>
          <span className="topbar-div"></span>
          <button type="button" className="btn btn-primary topbar-cta" onClick={() => openCreate("assign")}>
            <Icon d={ICONS.plus} size={14} />
            <span className="topbar-cta-text">Assign Asset</span>
          </button>
        </div>
      </header>

      <div className="shell">
        <Sidebar active={page} onNavigate={navTo} open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        counts={{ Employees: stats.employees, Assets: assets.length, Departments: stats.depts, "Audit Log": log.length, Users: window.USERS.length }}
        user={currentUser} onLogout={logout} />

        <main className="main" data-screen-label={page}>
          <div className="page-enter" key={page}>
          {page === "Departments" ?
            <DepartmentsPage assets={assets} departments={window.DEPARTMENTS} onOpenDept={openDeptFilter}
            onSelectAsset={(a) => {setSelected(a);setSelectedKey(a.id + "-dept");}} /> :
            page === "Reports" ?
            <ReportsPage assets={assets} departments={window.DEPARTMENTS} /> :
            page === "Audit Log" ?
            <AuditLogPage log={log} query={query} /> :
            page === "Users" ?
            <UsersPage users={window.USERS} log={log} /> :

            <React.Fragment>
              <div className="page-head">
                <h1 className="page-title">{page}</h1>
                <p className="page-caption">
                  {page === "Dashboard" ? "Equipment assignments across Task Source" :
                  page === "Employees" ? "Every employee and their assigned machine" :
                  "Full hardware register — specs and assignment"}
                </p>
              </div>

              {page === "Dashboard" ?
              <React.Fragment>
                  <div className="stats">
                    <StatCard label="Total Assets Assigned" value={stats.assigned} sub={`of ${window.TOTAL_INVENTORY} in inventory`} icon={ICONS.assets} ring={240} />
                    <StatCard label="Total Employees" value={stats.employees} sub="with a machine" icon={ICONS.employees} ring={168} />
                    <StatCard label="Departments" value={stats.depts} sub="across the org" icon={ICONS.departments} ring={28} />
                    <StatCard label="Peripheral Coverage" value={stats.coverage + "%"} sub="avg kit equipped" accent icon={ICONS.headphone} ring={272} />
                  </div>
                  <DashboardInsights assets={assets} onOpenDept={openDeptFilter} />
                </React.Fragment> :
              null}

              <div className="table-card">
                <div className="table-toolbar">
                  <div className="table-toolbar-title">
                    {page === "Dashboard" ? "Asset register" : page}
                    <span className="count-chip">{filtered.length}</span>
                    <span className="count-total">of {window.TOTAL_INVENTORY} assets</span>
                  </div>
                  <div className="table-filters">
                    {page === "Dashboard" ?
                    <button type="button" className="view-all-link" onClick={() => navTo("Assets")}>
                        View all assets <Icon d={ICONS.chevDown} size={13} style={{ transform: "rotate(-90deg)" }} />
                      </button> :

                    <React.Fragment>
                        <FilterDropdown label="Department" value={deptFilter} options={window.DEPARTMENTS} onChange={setDeptFilter} />
                        <FilterDropdown label="Type" value={typeFilter} options={window.ASSET_TYPES} onChange={setTypeFilter} />
                        {anyFilter ? <button type="button" className="clear-link" onClick={clearAll}>Clear</button> : null}
                        <button type="button" className="table-add-btn" onClick={() => openCreate(page === "Employees" ? "addEmployee" : "addAsset")}>
                          <Icon d={ICONS.plus} size={13} />
                          {page === "Employees" ? "Add Employee" : "Add Asset"}
                        </button>
                      </React.Fragment>
                    }
                  </div>
                </div>
                {filtered.length === 0 ?
                <EmptyState onClear={clearAll} /> :
                page === "Employees" ?
                <EmployeesGrid rows={filtered} onSelect={handleSelect} /> :
                isMobile ?
                <AssetCardList rows={page === "Dashboard" ? previewRows : filtered} onSelect={handleSelect} /> :

                <AssetTable rows={page === "Dashboard" ? previewRows : filtered}
                cols={VIEW_COLUMNS[page]} sort={sort} onSort={toggleSort}
                onSelect={handleSelect} selectedId={selectedKey} />
                }
                {page === "Dashboard" && filtered.length > previewRows.length ?
                <button type="button" className="table-foot-link" onClick={() => navTo("Assets")}>
                    View all {filtered.length} assets →
                  </button> :
                null}
              </div>
            </React.Fragment>
            }
          </div>
        </main>
      </div>

      <DetailDrawer asset={selected} onClose={closeDrawer} onEdit={openEdit} onRemove={handleRemove} />
      <AssignModal open={modalOpen} mode={modalMode} initial={editing}
      onClose={() => {setModalOpen(false);setEditing(null);}} onSubmit={handleSubmit}
      departments={window.DEPARTMENTS} types={window.ASSET_TYPES} assets={assets} />

      {toast ? <div className="toast">{toast}</div> : null}

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.accent}
        options={["#475569", "#6E56CF", "#0E7490", "#4F46E5"]}
        onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Table" />
        <TweakToggle label="Zebra striping" value={t.zebra} onChange={(v) => setTweak("zebra", v)} />
        <TweakToggle label="3D card tilt" value={t.tilt3d} onChange={(v) => setTweak("tilt3d", v)} />
      </TweaksPanel>
    </div>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);