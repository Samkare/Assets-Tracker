// Task Source — table, drawer, modal, page views

/* ---------- detail popup ---------- */
function DetailDrawer({ asset, onClose, onEdit, onRemove }) {
  useEffect(() => {
    if (!asset) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [asset, onClose]);
  if (!asset) return null;
  const a = asset;
  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <div className="modal modal-detail tilt-3d">
        <div className="modal-head">
          <div className="detail-head">
            <Avatar name={a.pseudo} shared={a.shared} size={44} />
            <div>
              <div className="modal-title">{a.pseudo}</div>
              <div className="modal-subtitle"><span className="mono">{a.id}</span> · {a.type}</div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>

        <div className="modal-body detail-body">
          <div className="drawer-tags">
            <DeptBadge dept={a.dept} />
            {a.shared ? <span className="shared-tag">Shared · day shift</span> : null}
          </div>

          <div className="detail-cols">
            <div className="drawer-section">
              <div className="drawer-section-title">Machine</div>
              <div className="field-grid">
                <Field label="Asset tag"><span className="mono">{a.id}</span></Field>
                <Field label="Type">{a.type}</Field>
                <Field label="CPU">{a.cpu || <span className="cell-muted">Not recorded</span>}</Field>
                <Field label="RAM">{a.ram || <span className="cell-muted">—</span>}</Field>
                <Field label="Storage">{a.hdd || <span className="cell-muted">—</span>}</Field>
                <Field label="Monitors"><MonitorCell value={a.monitors} /></Field>
              </div>
            </div>

            <div className="drawer-section">
              <div className="drawer-section-title">Monitor serials</div>
              <div className="field-grid">
                <Field label="Monitor 1">{a.mon1 ? <span className="mono">{a.mon1}</span> : <span className="cell-muted">—</span>}</Field>
                <Field label="Monitor 2">{a.mon2 ? <span className="mono">{a.mon2}</span> : <span className="cell-muted">—</span>}</Field>
              </div>
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section-title">Peripheral checklist</div>
            <div className="checklist checklist-grid">
              {PERIPHERALS.map((p) => (
                <div key={p.key} className={"check-row" + (a[p.key] ? " check-yes" : " check-no")}>
                  <span className="check-ico"><Icon d={p.icon} size={15} /></span>
                  <span className="check-label">{p.label}</span>
                  <span className="check-state">
                    {a[p.key] ? <><Icon d={ICONS.check} size={14} /> Yes</> : "No"}
                  </span>
                </div>
              ))}
              <div className={"check-row" + (a.whatsapp ? " check-yes" : " check-no")}>
                <span className="check-ico"><Icon d={ICONS.ipphone} size={15} /></span>
                <span className="check-label">WhatsApp line</span>
                <span className="check-state">{a.whatsapp ? <><Icon d={ICONS.check} size={14} /> Yes</> : "No"}</span>
              </div>
              <div className={"check-row" + (a.nextiva ? " check-yes" : " check-no")}>
                <span className="check-ico"><Icon d={ICONS.ipphone} size={15} /></span>
                <span className="check-label">Nextiva line</span>
                <span className="check-state">{a.nextiva ? <><Icon d={ICONS.check} size={14} /> Yes</> : "No"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot detail-foot">
          <button type="button" className="btn btn-ghost-danger" onClick={() => onRemove(a)}>Remove</button>
          <button type="button" className="btn btn-secondary" onClick={() => onEdit(a)}>
            <Icon d={ICONS.edit} size={14} /> Edit details
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- assign / add / edit modal ---------- */
const MODAL_COPY = {
  assign: { t: "Assign asset", s: "Register a machine to an employee.", b: "Assign asset" },
  addEmployee: { t: "Add employee", s: "Start with the person, then their assigned machine.", b: "Add employee" },
  addAsset: { t: "Add asset", s: "Start with the hardware, then who it’s assigned to.", b: "Add asset" },
  edit: { t: "Edit details", s: "Update this record.", b: "Save changes" },
};
function AssignModal({ open, mode = "assign", initial, onClose, onSubmit, departments, types, assets = [] }) {
  const blank = {
    pseudo: "", dept: departments[0], type: "Desktop", id: "",
    cpu: "", ram: "", hdd: "", mon1: "", mon2: "",
    headphone: false, speaker: false, ipPhone: false, webcam: false, mobileStand: false,
  };
  const [form, setForm] = useState(blank);
  const [touched, setTouched] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const formRef = useRef(null);
  useEffect(() => {
    if (open) {
      if (initial) {
        setForm({
          pseudo: initial.pseudo, dept: initial.dept, type: initial.type, id: initial.id,
          cpu: initial.cpu || "", ram: initial.ram || "", hdd: initial.hdd || "",
          mon1: initial.mon1 || "", mon2: initial.mon2 || "",
          headphone: !!initial.headphone, speaker: !!initial.speaker, ipPhone: !!initial.ipPhone,
          webcam: !!initial.webcam, mobileStand: !!initial.mobileStand,
        });
      } else { setForm(blank); }
      setTouched(false); setNameOpen(false);
      setTimeout(() => { const el = formRef.current && formRef.current.querySelector("input, select"); el && el.focus(); }, 60);
    }
  }, [open, initial]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const copy = MODAL_COPY[mode] || MODAL_COPY.assign;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggle = (k) => () => setForm({ ...form, [k]: !form[k] });

  /* ----- database lookups + duplicate detection ----- */
  const norm = (s) => (s || "").trim().toLowerCase();
  const others = assets.filter((a) => a !== initial);
  const nameQ = norm(form.pseudo);
  const suggestions = nameQ
    ? Array.from(new Map(others.filter((a) => !a.shared && norm(a.pseudo).includes(nameQ)).map((a) => [a.pseudo, a])).values()).slice(0, 6)
    : [];
  const sameName = others.filter((a) => !a.shared && norm(a.pseudo) === nameQ);
  const tagDup = form.id.trim() ? others.find((a) => norm(a.id) === norm(form.id)) : null;
  const ser1Dup = form.mon1.trim() ? others.find((a) => [a.mon1, a.mon2].some((s) => s && norm(s) === norm(form.mon1))) : null;
  const ser2Dup = form.mon2.trim() ? others.find((a) => [a.mon1, a.mon2].some((s) => s && norm(s) === norm(form.mon2))) : null;
  const serSelfDup = form.mon1.trim() && form.mon2.trim() && norm(form.mon1) === norm(form.mon2);

  const hardError = !!tagDup || serSelfDup;
  const valid = form.pseudo.trim() && form.id.trim() && !hardError;
  const submit = (e) => { e.preventDefault(); setTouched(true); if (!valid) return; onSubmit(form); };
  const pickName = (a) => { setForm((f) => ({ ...f, pseudo: a.pseudo, dept: a.dept })); setNameOpen(false); };
  const isAsset = mode === "addAsset";

  const employeeBlock = (
    <div className="form-section" key="emp">
      <div className="form-section-title">{isAsset ? "Assignment" : "Employee"}</div>
      <div className="form-cols">
        <div className="form-row">
          <span className="form-label">{isAsset ? "Assigned employee" : "Employee (pseudo name)"}</span>
          <div className="field-ac">
            <input className={"input" + (touched && !form.pseudo.trim() ? " input-error" : "")}
              placeholder="e.g. Atlas" value={form.pseudo} autoComplete="off"
              onChange={(e) => { setForm({ ...form, pseudo: e.target.value }); setNameOpen(true); }}
              onFocus={() => setNameOpen(true)}
              onBlur={() => setTimeout(() => setNameOpen(false), 140)} />
            {nameOpen && suggestions.length ? (
              <div className="ac-menu">
                <div className="ac-head">In database</div>
                {suggestions.map((a) => (
                  <button type="button" key={a.id} className="ac-item" onMouseDown={(e) => { e.preventDefault(); pickName(a); }}>
                    <Avatar name={a.pseudo} size={24} />
                    <span className="ac-name">{a.pseudo}</span>
                    <span className="ac-dept">{a.dept}</span>
                    <span className="mono ac-tag">{a.id}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {sameName.length ? (
            <span className="form-flag flag-info">
              Existing employee — already has {sameName.length} {sameName.length === 1 ? "machine" : "machines"} ({sameName.slice(0, 3).map((a) => a.id).join(", ")})
            </span>
          ) : null}
        </div>
        <label className="form-row">
          <span className="form-label">Department</span>
          <select className="input" value={form.dept} onChange={set("dept")}>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>
    </div>
  );

  const machineBlock = (
    <div className="form-section" key="mac">
      <div className="form-section-title">{isAsset ? "Machine specifications" : "Assigned machine"}</div>
      <div className="form-cols">
        <label className="form-row">
          <span className="form-label">Type</span>
          <select className="input" value={form.type} onChange={set("type")}>
            {types.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <div className="form-row">
          <span className="form-label">Asset tag</span>
          <input className={"input mono" + ((touched && !form.id.trim()) || tagDup ? " input-error" : "")}
            placeholder="TS-PC-000" value={form.id} onChange={set("id")} autoComplete="off" />
          {tagDup ? (
            <span className="form-flag flag-error">Asset tag already exists — {tagDup.shared ? "Day-Shift PC" : tagDup.pseudo} · {tagDup.dept}</span>
          ) : null}
        </div>
      </div>
      <div className="form-cols-3">
        <label className="form-row">
          <span className="form-label">CPU</span>
          <input className="input" placeholder="Intel i5 12th Gen" value={form.cpu} onChange={set("cpu")} />
        </label>
        <label className="form-row">
          <span className="form-label">RAM</span>
          <input className="input" placeholder="16 GB" value={form.ram} onChange={set("ram")} />
        </label>
        <label className="form-row">
          <span className="form-label">Storage</span>
          <input className="input" placeholder="480 GB" value={form.hdd} onChange={set("hdd")} />
        </label>
      </div>
      <div className="form-cols">
        <div className="form-row">
          <span className="form-label">Monitor 1 serial</span>
          <input className={"input mono" + (ser1Dup || serSelfDup ? " input-warn" : "")}
            placeholder="Optional" value={form.mon1} onChange={set("mon1")} autoComplete="off" />
          {ser1Dup ? <span className="form-flag flag-warn">Serial already on {ser1Dup.id}</span>
            : serSelfDup ? <span className="form-flag flag-error">Same serial in both fields</span> : null}
        </div>
        <div className="form-row">
          <span className="form-label">Monitor 2 serial</span>
          <input className={"input mono" + (ser2Dup ? " input-warn" : "")}
            placeholder="Optional" value={form.mon2} onChange={set("mon2")} autoComplete="off" />
          {ser2Dup ? <span className="form-flag flag-warn">Serial already on {ser2Dup.id}</span> : null}
        </div>
      </div>
      <div className="form-row">
        <span className="form-label">Peripherals</span>
        <div className="periph-toggle-row">
          {PERIPHERALS.map((p) => (
            <button type="button" key={p.key} className={"periph-toggle" + (form[p.key] ? " periph-toggle-on" : "")}
              onClick={toggle(p.key)}>
              <Icon d={p.icon} size={14} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-root">
      <div className="modal-scrim" onClick={onClose}></div>
      <form className="modal tilt-3d" onSubmit={submit} ref={formRef}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{copy.t}</div>
            <div className="modal-subtitle">{copy.s}</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close form">
            <Icon d={ICONS.close} size={16} />
          </button>
        </div>
        <div className="modal-body">
          {isAsset ? [machineBlock, employeeBlock] : [employeeBlock, machineBlock]}
        </div>
        <div className="modal-foot">
          {hardError ? <span className="foot-err">Resolve duplicates to continue</span> : null}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className={"btn btn-primary" + (hardError ? " btn-disabled" : "")}>{copy.b}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- asset table (column-configurable per view) ---------- */
function PersonCell(a) {
  return (
    <span className="cell-person">
      <Avatar name={a.pseudo} shared={a.shared} />
      <span className={"cell-person-name" + (a.shared ? " cell-shared" : "")}>{a.pseudo}</span>
    </span>
  );
}
const COLDEFS = {
  employee:   { label: "Employee", sortKey: "pseudo", render: PersonCell },
  assignedTo: { label: "Assigned To", sortKey: "pseudo", render: PersonCell },
  dept:       { label: "Department", sortKey: "dept", render: (a) => <DeptBadge dept={a.dept} /> },
  type:       { label: "Type", sortKey: "type", render: (a) => (
                  <span className="cell-type"><span className="type-icon"><Icon d={typeIcon(a.type)} size={14} /></span>{a.type}</span>) },
  tag:        { label: "Asset Tag", sortKey: "id", render: (a) => <span className="mono cell-tag">{a.id}</span> },
  cpu:        { label: "CPU", sortKey: "cpu", render: (a) => a.cpu || <span className="cell-muted">—</span> },
  ram:        { label: "RAM", sortKey: "ram", render: (a) => a.ram || <span className="cell-muted">—</span> },
  hdd:        { label: "HDD", sortKey: "hdd", render: (a) => a.hdd || <span className="cell-muted">—</span> },
  monitors:   { label: "Monitors", sortKey: "monitors", render: (a) => <MonitorCell value={a.monitors} /> },
  periph:     { label: "Peripherals", sortable: false, thClass: "th-periph", tdClass: "td-periph", render: (a) => <PeriphChips asset={a} /> },
};
const VIEW_COLUMNS = {
  Dashboard: ["employee", "dept", "type", "tag", "monitors", "periph"],
  Employees: ["employee", "dept", "type", "tag", "monitors", "periph"],
  Assets:    ["tag", "type", "cpu", "ram", "hdd", "monitors", "assignedTo", "dept"],
};

function AssetTable({ rows, cols, sort, onSort, onSelect, selectedId }) {
  const columns = cols.map((k) => ({ key: k, ...COLDEFS[k] }));
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort.key === c.sortKey;
              return (
                <th key={c.key} className={c.thClass || ""}>
                  {c.sortable === false ? (
                    <span className="th-plain">{c.label}</span>
                  ) : (
                    <button type="button" className={"th-btn" + (active ? " th-active" : "")} onClick={() => onSort(c.sortKey)}>
                      <span>{c.label}</span>
                      <span className={"sort-arrow" + (active ? " sort-arrow-on" : "")}>
                        {active && sort.dir === -1 ? "↓" : "↑"}
                      </span>
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((a, i) => (
            <tr key={a.id + "-" + i} className={selectedId === a.id + "-" + i ? "row-selected" : ""}
              tabIndex={0} role="button"
              onClick={() => onSelect(a, i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(a, i); } }}>
              {columns.map((c) => <td key={c.key} className={c.tdClass || ""}>{c.render(a)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- employees: people card grid (distinct from Assets table) ---------- */
function EmployeesGrid({ rows, onSelect }) {
  return (
    <div className="emp-grid">
      {rows.map((a, i) => (
        <button type="button" key={a.id + "-" + i} className="emp-card tilt-3d"
          onClick={() => onSelect(a, i)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(a, i); } }}>
          <div className="emp-card-top">
            <Avatar name={a.pseudo} shared={a.shared} size={42} />
            <div className="emp-card-id">
              <div className={"emp-card-name" + (a.shared ? " cell-shared" : "")}>{a.pseudo}</div>
              <DeptBadge dept={a.dept} />
            </div>
            <span className="emp-card-type" title={a.type}>
              <Icon d={typeIcon(a.type)} size={15} />
            </span>
          </div>
          <div className="emp-card-meta">
            <span className="emp-card-tag mono">{a.id}</span>
            <span className="emp-card-dot">·</span>
            <MonitorCell value={a.monitors} />
          </div>
          <div className="emp-card-foot">
            <PeriphChips asset={a} />
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------- mobile card fallback for the asset/dashboard table ---------- */
function AssetCardList({ rows, onSelect }) {
  return (
    <div className="asset-cards">
      {rows.map((a, i) => (
        <button type="button" key={a.id + "-" + i} className="asset-card" onClick={() => onSelect(a, i)}>
          <div className="asset-card-head">
            <span className="cell-person">
              <Avatar name={a.pseudo} shared={a.shared} size={30} />
              <span className={"cell-person-name" + (a.shared ? " cell-shared" : "")}>{a.pseudo}</span>
            </span>
            <span className="mono cell-tag">{a.id}</span>
          </div>
          <div className="asset-card-meta">
            <DeptBadge dept={a.dept} />
            <span className="cell-type"><Icon d={typeIcon(a.type)} size={13} /> {a.type}</span>
            <MonitorCell value={a.monitors} />
          </div>
          {(a.cpu || a.ram || a.hdd) ? (
            <div className="asset-card-specs">
              {[a.cpu, a.ram, a.hdd].filter(Boolean).join(" · ")}
            </div>
          ) : null}
          <div className="asset-card-foot"><PeriphChips asset={a} /></div>
        </button>
      ))}
    </div>
  );
}

/* ---------- empty state ---------- */
function EmptyState({ onClear }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon d={ICONS.search} size={20} /></div>
      <div className="empty-title">No assets match</div>
      <div className="empty-sub">Nothing matches the current search and filters.</div>
      <button type="button" className="btn btn-secondary" onClick={onClear}>Clear search &amp; filters</button>
    </div>
  );
}

Object.assign(window, { DetailDrawer, AssignModal, AssetTable, AssetCardList, EmployeesGrid, VIEW_COLUMNS, EmptyState });
