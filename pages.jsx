// Task Source — Departments & Reports pages

function coverageOf(list) {
  if (!list.length) return 0;
  let yes = 0;
  list.forEach((a) => { PERIPHERALS.forEach((p) => { if (a[p.key]) yes++; }); });
  return Math.round((yes / (list.length * PERIPHERALS.length)) * 100);
}

/* ---------- Dashboard insight panels ---------- */
function DashboardInsights({ assets, onOpenDept }) {
  const deptData = useMemo(() => {
    const max = Math.max(1, ...new Set());
    const list = (window.DEPARTMENTS).map((d) => ({ dept: d, count: assets.filter((a) => a.dept === d).length }))
      .filter((x) => x.count > 0).sort((a, b) => b.count - a.count);
    const top = list.slice(0, 8);
    const peak = Math.max(1, ...top.map((x) => x.count));
    return { top, peak };
  }, [assets]);

  const periphData = useMemo(() => PERIPHERALS.map((p) => {
    const yes = assets.filter((a) => a[p.key]).length;
    return { label: p.label, icon: p.icon, pct: Math.round((yes / assets.length) * 100) };
  }), [assets]);

  return (
    <div className="insight-grid">
      <div className="report-card tilt-3d">
        <div className="report-card-title">Fleet by department</div>
        <div className="report-bars">
          {deptData.top.map((d) => (
            <button type="button" className="report-bar-row insight-bar-row" key={d.dept} onClick={() => onOpenDept(d.dept)}>
              <span className="report-bar-label report-bar-label-dept">
                <span className="dept-swatch sm" style={{ background: `oklch(0.58 0.15 ${deptHue(d.dept)})` }}></span>
                {d.dept}
              </span>
              <div className="report-bar-track">
                <div className="report-bar-fill" style={{ width: Math.max((d.count / deptData.peak) * 100, 3) + "%", background: `oklch(0.6 0.14 ${deptHue(d.dept)})` }}></div>
              </div>
              <span className="report-bar-val">{d.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="report-card tilt-3d">
        <div className="report-card-title">Peripheral coverage</div>
        <div className="report-bars">
          {periphData.map((p) => (
            <div className="report-bar-row" key={p.label}>
              <span className="report-bar-label"><Icon d={p.icon} size={14} /> {p.label}</span>
              <div className="report-bar-track">
                <div className="report-bar-fill" style={{ width: Math.max(p.pct, 2) + "%" }}></div>
              </div>
              <span className="report-bar-val">{p.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Department detail modal ---------- */
function DepartmentModal({ dept, assets, onClose, onSelectAsset, onViewAll }) {
  useEffect(() => {
    if (!dept) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dept, onClose]);
  if (!dept) return null;
  const list = assets.filter((a) => a.dept === dept);
  const people = list.filter((a) => !a.shared).length;
  const dual = list.filter((a) => a.monitors === "Dual").length;
  const cov = coverageOf(list);
  const h = deptHue(dept);
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <div className="modal modal-dept tilt-3d">
        <div className="modal-head">
          <div className="deptm-head">
            <span className="deptm-swatch" style={{ background: `oklch(0.58 0.15 ${h})` }}></span>
            <div>
              <div className="modal-title">{dept}</div>
              <div className="modal-subtitle">{list.length} {list.length === 1 ? "asset" : "assets"} · {people} {people === 1 ? "person" : "people"}</div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close department">
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>
        <div className="deptm-stats">
          <div className="deptm-stat"><div className="deptm-stat-num">{list.length}</div><div className="deptm-stat-lbl">Assets</div></div>
          <div className="deptm-stat"><div className="deptm-stat-num">{people}</div><div className="deptm-stat-lbl">People</div></div>
          <div className="deptm-stat"><div className="deptm-stat-num">{dual}</div><div className="deptm-stat-lbl">Dual monitor</div></div>
          <div className="deptm-stat"><div className="deptm-stat-num" style={{ color: `oklch(0.5 0.13 ${h})` }}>{cov}%</div><div className="deptm-stat-lbl">Coverage</div></div>
        </div>
        <div className="deptm-list">
          {list.map((a, i) => (
            <button type="button" key={a.id + "-" + i} className="deptm-row" onClick={() => onSelectAsset(a)}>
              <Avatar name={a.pseudo} shared={a.shared} size={28} />
              <span className={"deptm-row-name" + (a.shared ? " cell-shared" : "")}>{a.pseudo}</span>
              <span className="deptm-row-type"><Icon d={typeIcon(a.type)} size={13} /> {a.type}</span>
              <span className="mono deptm-row-tag">{a.id}</span>
              <span className="deptm-row-mon"><MonitorCell value={a.monitors} /></span>
            </button>
          ))}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary" onClick={() => onViewAll(dept)}>Open in Assets register</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Departments page ---------- */
function DepartmentsPage({ assets, departments, onOpenDept, onSelectAsset }) {
  const [openDept, setOpenDept] = useState(null);
  const data = useMemo(() => departments.map((d) => {
    const list = assets.filter((a) => a.dept === d);
    const people = list.filter((a) => !a.shared).length;
    const dual = list.filter((a) => a.monitors === "Dual").length;
    return { dept: d, count: list.length, people, dual, coverage: coverageOf(list) };
  }).filter((x) => x.count > 0).sort((a, b) => b.count - a.count), [assets, departments]);

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Departments</h1>
        <p className="page-caption">{data.length} departments · equipment distribution and kit coverage</p>
      </div>
      <div className="dept-grid">
        {data.map((d) => {
          const h = deptHue(d.dept);
          return (
            <button type="button" className="dept-card tilt-3d" key={d.dept} onClick={() => setOpenDept(d.dept)}>
              <div className="dept-card-head">
                <span className="dept-swatch" style={{ background: `oklch(0.58 0.15 ${h})` }}></span>
                <span className="dept-card-name">{d.dept}</span>
                <span className="dept-card-count">{d.count}</span>
              </div>
              <div className="dept-card-stats">
                <span>{d.people} {d.people === 1 ? "person" : "people"}</span>
                <span className="dot-sep">·</span>
                <span>{d.dual} dual-monitor</span>
              </div>
              <div className="dept-bar">
                <div className="dept-bar-fill" style={{ width: d.coverage + "%", background: `oklch(0.6 0.14 ${h})` }}></div>
              </div>
              <div className="dept-bar-label">{d.coverage}% peripheral coverage</div>
            </button>
          );
        })}
      </div>
      <DepartmentModal dept={openDept} assets={assets}
        onClose={() => setOpenDept(null)}
        onSelectAsset={(a) => { setOpenDept(null); onSelectAsset(a); }}
        onViewAll={(d) => { setOpenDept(null); onOpenDept(d); }} />
    </React.Fragment>
  );
}

/* ---------- Reports page ---------- */
function cpuFamily(c) {
  if (!c) return "Not recorded";
  const s = c.toLowerCase();
  if (s.includes("mac")) return "Mac Mini";
  const m = s.match(/i\s*([3579])/);
  if (m) return "Intel i" + m[1];
  if (s.includes("ryzen")) return "AMD Ryzen";
  if (s.includes("celeron")) return "Celeron";
  if (s.includes("pentium")) return "Pentium";
  return "Other";
}
function ReportsPage({ assets, departments }) {
  const total = assets.length;
  const periphData = useMemo(() => PERIPHERALS.map((p) => {
    const yes = assets.filter((a) => a[p.key]).length;
    return { label: p.label, icon: p.icon, yes, pct: Math.round((yes / total) * 100) };
  }), [assets]);

  const deptCoverage = useMemo(() => departments.map((d) => {
    const list = assets.filter((a) => a.dept === d);
    return { dept: d, count: list.length, coverage: coverageOf(list) };
  }).filter((x) => x.count > 0).sort((a, b) => b.coverage - a.coverage), [assets, departments]);

  const ramDist = useMemo(() => {
    const m = {};
    assets.forEach((a) => { const k = a.ram || "Not recorded"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([label, count]) => ({ label, count, gb: parseInt(label) || -1 }))
      .sort((a, b) => b.gb - a.gb);
  }, [assets]);

  const cpuDist = useMemo(() => {
    const m = {};
    assets.forEach((a) => { const k = cpuFamily(a.cpu); m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [assets]);

  const dual = assets.filter((a) => a.monitors === "Dual").length;
  const single = assets.filter((a) => a.monitors === "Single").length;
  const noMon = assets.filter((a) => a.monitors === "—").length;
  const shared = assets.filter((a) => a.shared).length;
  const avgCov = coverageOf(assets);

  const gaps = useMemo(() => {
    const bare = assets.filter((a) => PERIPHERALS.every((p) => !a[p.key])).length;
    return [
      { label: "No peripherals at all", count: bare, hint: "machines with an empty kit", sev: "high" },
      { label: "Missing headset", count: assets.filter((a) => !a.headphone).length, hint: "no headphone assigned", sev: "mid" },
      { label: "Missing IP phone", count: assets.filter((a) => !a.ipPhone).length, hint: "no desk phone line", sev: "mid" },
      { label: "Missing web cam", count: assets.filter((a) => !a.webcam).length, hint: "no camera on record", sev: "low" },
      { label: "Incomplete specs", count: assets.filter((a) => !a.cpu || !a.ram).length, hint: "CPU or RAM not recorded", sev: "high" },
    ];
  }, [assets]);

  const ramPeak = Math.max(1, ...ramDist.map((r) => r.count));
  const cpuPeak = Math.max(1, ...cpuDist.map((r) => r.count));
  const kpis = [
    { label: "Total machines", value: total, sub: `${window.TOTAL_INVENTORY} in inventory` },
    { label: "Departments", value: new Set(assets.map((a) => a.dept)).size, sub: "across the org" },
    { label: "Dual-monitor", value: dual, sub: `${Math.round((dual / total) * 100)}% of desks` },
    { label: "Shared pool", value: shared, sub: "day-shift machines" },
    { label: "Avg coverage", value: avgCov + "%", sub: "peripheral kit", accent: true },
  ];

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Reports</h1>
        <p className="page-caption">Fleet composition, peripheral coverage, and equipment gaps</p>
      </div>

      <div className="report-kpis">
        {kpis.map((k) => (
          <div className="report-kpi tilt-3d" key={k.label}>
            <div className="report-kpi-label">{k.label}</div>
            <div className={"report-kpi-value" + (k.accent ? " stat-accent" : "")}>{k.value}</div>
            <div className="report-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="report-grid">
        <div className="report-card tilt-3d">
          <div className="report-card-title">Processor &amp; memory</div>
          <div className="report-bars">
            {cpuDist.map((r) => (
              <div className="report-bar-row" key={r.label}>
                <span className="report-bar-label report-bar-label-ram">{r.label}</span>
                <div className="report-bar-track">
                  <div className="report-bar-fill" style={{ width: Math.max((r.count / cpuPeak) * 100, 2) + "%" }}></div>
                </div>
                <span className="report-bar-val">{r.count}</span>
              </div>
            ))}
          </div>
          <div className="report-sub-title">Memory (RAM)</div>
          <div className="report-bars">
            {ramDist.map((r) => (
              <div className="report-bar-row" key={r.label}>
                <span className="report-bar-label report-bar-label-ram">{r.label}</span>
                <div className="report-bar-track">
                  <div className="report-bar-fill" style={{ width: Math.max((r.count / ramPeak) * 100, 2) + "%" }}></div>
                </div>
                <span className="report-bar-val">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="report-card tilt-3d">
          <div className="report-card-title">Monitor setup</div>
          <div className="mon-split">
            <div className="mon-split-item">
              <div className="mon-split-num">{dual}</div>
              <div className="mon-split-lbl">Dual</div>
            </div>
            <div className="mon-split-item">
              <div className="mon-split-num">{single}</div>
              <div className="mon-split-lbl">Single</div>
            </div>
            <div className="mon-split-item">
              <div className="mon-split-num">{noMon}</div>
              <div className="mon-split-lbl">Not recorded</div>
            </div>
          </div>
          <div className="mon-stack">
            <div className="mon-stack-seg seg-dual" style={{ flex: dual }}></div>
            <div className="mon-stack-seg seg-single" style={{ flex: single }}></div>
            <div className="mon-stack-seg seg-none" style={{ flex: noMon }}></div>
          </div>

          <div className="report-sub-title">Peripheral distribution</div>
          <div className="report-bars">
            {periphData.map((p) => (
              <div className="report-bar-row" key={p.label}>
                <span className="report-bar-label"><Icon d={p.icon} size={14} /> {p.label}</span>
                <div className="report-bar-track">
                  <div className="report-bar-fill" style={{ width: Math.max(p.pct, 2) + "%" }}></div>
                </div>
                <span className="report-bar-val">{p.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="report-card report-card-wide">
          <div className="report-card-title">Peripheral coverage by department</div>
          <div className="report-bars report-bars-2col">
            {deptCoverage.map((d) => (
              <div className="report-bar-row" key={d.dept}>
                <span className="report-bar-label report-bar-label-dept">
                  <span className="dept-swatch sm" style={{ background: `oklch(0.58 0.15 ${deptHue(d.dept)})` }}></span>
                  {d.dept} <span className="report-bar-count">{d.count}</span>
                </span>
                <div className="report-bar-track">
                  <div className="report-bar-fill" style={{ width: Math.max(d.coverage, 2) + "%", background: `oklch(0.6 0.14 ${deptHue(d.dept)})` }}></div>
                </div>
                <span className="report-bar-val">{d.coverage}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="report-card report-card-wide">
          <div className="report-card-title">Equipment gaps
            <span className="report-card-hint">opportunities to complete the fleet</span>
          </div>
          <div className="gap-grid">
            {gaps.map((g) => (
              <div className={"gap-tile tilt-3d gap-" + g.sev} key={g.label}>
                <div className="gap-count">{g.count}</div>
                <div className="gap-label">{g.label}</div>
                <div className="gap-hint">{g.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

/* ---------- Audit Log page ---------- */
const ACTION_META = {
  added: { label: "Added", cls: "act-green", icon: ICONS.plus },
  assigned: { label: "Assigned", cls: "act-accent", icon: ICONS.employees },
  reassigned: { label: "Reassigned", cls: "act-accent", icon: ICONS.employees },
  edited: { label: "Edited", cls: "act-blue", icon: ICONS.edit },
  removed: { label: "Removed", cls: "act-red", icon: ICONS.close },
  repair: { label: "Repair", cls: "act-amber", icon: ICONS.wrench || ICONS.reports },
};
function fmtTime(d) {
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return h + ":" + String(m).padStart(2, "0") + " " + ap;
}
function dayLabel(d) {
  const today = new Date(2026, 5, 15);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - a) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function AuditLogPage({ log, query }) {
  const [actionFilter, setActionFilter] = useState("All");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return log.filter((e) => {
      if (actionFilter !== "All" && ACTION_META[e.action] && ACTION_META[e.action].label !== actionFilter) return false;
      if (q) {
        const hay = [e.tag, e.subject, e.dept, e.detail, e.actor].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [log, query, actionFilter]);

  const groups = useMemo(() => {
    const g = [];
    let cur = null;
    rows.forEach((e) => {
      const d = new Date(e.ts);
      const lbl = dayLabel(d);
      if (!cur || cur.label !== lbl) { cur = { label: lbl, items: [] }; g.push(cur); }
      cur.items.push({ ...e, d });
    });
    return g;
  }, [rows]);

  const actionOpts = ["All", "Added", "Assigned", "Edited", "Removed", "Repair"];

  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Audit Log</h1>
        <p className="page-caption">Every equipment change — who, what, and when</p>
      </div>

      <div className="audit-filters">
        {actionOpts.map((o) => (
          <button type="button" key={o}
            className={"audit-chip" + (actionFilter === o ? " audit-chip-on" : "")}
            onClick={() => setActionFilter(o)}>{o}</button>
        ))}
        <span className="audit-count">{rows.length} {rows.length === 1 ? "event" : "events"}</span>
      </div>

      {groups.length === 0 ? (
        <div className="table-card">
          <div className="empty-state">
            <div className="empty-icon"><Icon d={ICONS.history} size={20} /></div>
            <div className="empty-title">No matching activity</div>
            <div className="empty-sub">Try a different search or filter.</div>
          </div>
        </div>
      ) : (
        <div className="audit-feed">
          {groups.map((grp) => (
            <div className="audit-day" key={grp.label}>
              <div className="audit-day-label">{grp.label}</div>
              <div className="audit-items">
                {grp.items.map((e, i) => {
                  const meta = ACTION_META[e.action] || ACTION_META.edited;
                  return (
                    <div className="audit-row" key={e.ts + "-" + i}>
                      <div className="audit-time">{fmtTime(e.d)}</div>
                      <div className={"audit-icon " + meta.cls}><Icon d={meta.icon} size={13} /></div>
                      <div className="audit-body">
                        <div className="audit-line">
                          <span className={"audit-action " + meta.cls}>{meta.label}</span>
                          <span className="mono audit-tag">{e.tag}</span>
                          <span className="audit-subject">{e.subject}</span>
                          <DeptBadge dept={e.dept} />
                        </div>
                        <div className="audit-detail">{e.detail}</div>
                      </div>
                      <div className="audit-actor">
                        <Avatar name={e.actor} size={22} />
                        <span>{e.actor}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </React.Fragment>
  );
}

/* ---------- Users (IT team) page ---------- */
function relTime(ts) {
  const d = new Date(ts), now = new Date(2026, 5, 15, 12);
  const days = Math.floor((now - d) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return days + " days ago";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function UsersPage({ users, log }) {
  const mgr = users.filter((u) => /manager/i.test(u.role)).length;
  return (
    <React.Fragment>
      <div className="page-head">
        <h1 className="page-title">Users</h1>
        <p className="page-caption">{users.length} IT team members · {mgr} manager · {users.length - mgr} members</p>
      </div>
      <div className="users-grid">
        {users.map((u) => {
          const acts = log.filter((l) => l.actor === u.name);
          const last = acts[0];
          const isMgr = /manager/i.test(u.role);
          return (
            <div className="user-card tilt-3d" key={u.name}>
              <div className="user-card-head">
                <Avatar name={u.name} size={52} />
                <div className="user-id">
                  <div className="user-name">{u.name}</div>
                  <span className={"user-role " + (isMgr ? "role-mgr" : "role-mem")}>
                    {isMgr ? <Icon d={ICONS.shield} size={12} /> : null}{u.role}
                  </span>
                </div>
              </div>
              <p className="user-focus">{u.focus}</p>
              <div className="user-fields">
                <div className="user-field"><span className="user-field-ico"><Icon d={ICONS.mail} size={14} /></span>{u.email}</div>
                <div className="user-field"><span className="user-field-ico"><Icon d={ICONS.ipphone} size={14} /></span>{u.phone}</div>
                <div className="user-field"><span className="user-field-ico"><Icon d={ICONS.history} size={14} /></span>Joined {new Date(u.since).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
              </div>
              <div className="user-foot">
                <div className="user-stat"><b>{acts.length}</b> changes logged</div>
                {last ? <div className="user-last">Last edit {relTime(last.ts)} · <span className="mono">{last.tag}</span></div> : <div className="user-last">No activity yet</div>}
              </div>
            </div>
          );
        })}
      </div>
    </React.Fragment>
  );
}

/* ---------- Login screen ---------- */
function LoginScreen({ users, onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = (e) => {
    e.preventDefault();
    const q = email.trim().toLowerCase();
    const u = users.find((x) => x.email.toLowerCase() === q || x.name.toLowerCase() === q);
    if (!u) { setErr("No IT account found. Use your work email or name."); return; }
    if (!pw.trim()) { setErr("Please enter your password."); return; }
    onLogin(u);
  };
  return (
    <div className="login-stage">
      <div className="login-card tilt-3d">
        <div className="login-brand">
          <img className="login-logo" src={(window.__resources && window.__resources.logo) || "logo.png"} alt="Task Source" />
          <span className="login-tagline">IT Asset Tracker</span>
        </div>
        <h1 className="login-title">Sign in to your workspace</h1>
        <p className="login-sub">Restricted to the IT operations team.</p>
        <form onSubmit={submit} className="login-form">
          <label className="form-row">
            <span className="form-label">Work email or name</span>
            <input className={"input" + (err && !email ? " input-error" : "")} type="text" autoComplete="username"
              placeholder="e.g. Santosh or santosh@tasksource.io" value={email}
              onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
          </label>
          <label className="form-row">
            <span className="form-label">Password</span>
            <input className="input" type="password" autoComplete="current-password"
              placeholder="••••••••" value={pw}
              onChange={(e) => { setPw(e.target.value); setErr(""); }} />
          </label>
          {err ? <div className="login-err">{err}</div> : null}
          <button type="submit" className="btn btn-primary login-btn">Sign in</button>
        </form>
        <div className="login-quick">
          <span className="login-quick-label">Quick sign-in</span>
          <div className="login-chips">
            {users.map((u) => (
              <button type="button" key={u.name} className="login-chip" onClick={() => onLogin(u)}>
                <Avatar name={u.name} size={22} />
                <span className="login-chip-name">{u.name}</span>
                <span className="login-chip-role">{/manager/i.test(u.role) ? "Manager" : "Member"}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="login-help">
          <Icon d={ICONS.shield} size={13} />
          <span>New to the team? Ask your manager <a href="mailto:santosh@tasksource.io">Santosh</a> to set up your account.</span>
        </div>
        <div className="login-foot">Demo workspace — any password is accepted.</div>
      </div>
    </div>
  );
}

Object.assign(window, { coverageOf, cpuFamily, DashboardInsights, DepartmentModal, DepartmentsPage, ReportsPage, AuditLogPage, UsersPage, LoginScreen });
