// Side drawer with full asset + employee detail, and the Assign Equipment modal

function DetailRow({ label, value, mono }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={'detail-value' + (mono ? ' mono' : '')}>{value || '—'}</span>
    </div>
  );
}

function AssetDrawer({ asset, onClose, onUpdate }) {
  const open = !!asset;
  const [last, setLast] = React.useState(asset);
  React.useEffect(() => { if (asset) setLast(asset); }, [asset]);
  const a = asset || last;
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (!a) return null;
  const periphs = Object.entries(a.periph || {});
  const hasPeriphs = periphs.length > 0;
  const model = [a.cpu, a.ram, a.hdd].filter(Boolean).join(' · ');
  return (
    <div className={'drawer-root' + (open ? ' drawer-open' : '')} aria-hidden={!open}>
      <div className="drawer-scrim" onClick={onClose}></div>
      <aside className="drawer" data-screen-label="Asset detail drawer">
        <header className="drawer-head">
          <div className="drawer-title-group">
            <div className="drawer-tag mono">{a.tag}</div>
            <StatusPill status={a.status} />
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon.x /></button>
        </header>

        <div className="drawer-body">
          <section className="drawer-section">
            <h3 className="drawer-h3">Assignment</h3>
            {a.name ? (
              <div className="drawer-person">
                <Avatar name={a.name} size={36} />
                <div>
                  <div className="drawer-person-name">{a.name}</div>
                  <div className="drawer-person-sub">{a.dept}</div>
                </div>
              </div>
            ) : (
              <div className="drawer-unassigned">Not assigned to anyone</div>
            )}
            <DetailRow label="Department" value={a.dept} />
            <DetailRow label="Assigned date" value={fmtDate(a.date)} />
          </section>

          <section className="drawer-section">
            <h3 className="drawer-h3">Hardware</h3>
            <DetailRow label="Equipment type" value={a.type} />
            <DetailRow label="Asset ID" value={a.tag} mono />
            {model ? <DetailRow label="Specification" value={model} /> : null}
            <DetailRow label="Monitor 1 S/N" value={a.sn1} mono />
            <DetailRow label="Monitor 2 S/N" value={a.sn2} mono />
          </section>

          {hasPeriphs ? (
            <section className="drawer-section">
              <h3 className="drawer-h3">Peripherals</h3>
              <div className="periph-chips">
                {periphs.map(([k, v]) => (
                  <span key={k} className={'chip' + (v ? ' chip-on' : '')}>
                    <span className="chip-mark">{v ? '✓' : '—'}</span>{PERIPH_LABELS[k]}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="drawer-section">
            <h3 className="drawer-h3">Actions</h3>
            <div className="drawer-actions">
              {a.status !== 'Assigned' && a.name ? (
                <button type="button" className="btn btn-secondary" onClick={() => onUpdate(a.id, { status: 'Assigned' })}>Mark assigned</button>
              ) : null}
              {a.status !== 'In Repair' ? (
                <button type="button" className="btn btn-secondary" onClick={() => onUpdate(a.id, { status: 'In Repair' })}>Send to repair</button>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={() => onUpdate(a.id, { status: a.name ? 'Assigned' : 'Available' })}>Repair complete</button>
              )}
              {a.status === 'Assigned' || a.name ? (
                <button type="button" className="btn btn-danger-ghost" onClick={() => onUpdate(a.id, { status: 'Available', name: null, date: null })}>Unassign</button>
              ) : null}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function AssignModal({ open, departments, existingTags, onClose, onSubmit }) {
  const blank = { name: '', dept: departments[0] || '', type: 'Desktop', tag: '', serial: '', date: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = React.useState(blank);
  const [errors, setErrors] = React.useState({});
  const firstRef = React.useRef(null);
  React.useEffect(() => {
    if (open) { setForm(blank); setErrors({}); setTimeout(() => firstRef.current && firstRef.current.focus(), 60); }
  }, [open]);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim()) errs.name = 'Employee name is required';
    if (!form.tag.trim()) errs.tag = 'Asset ID is required';
    else if (existingTags.has(form.tag.trim().toUpperCase())) errs.tag = 'This asset ID already exists';
    if (!form.date) errs.date = 'Pick a date';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({
      name: form.name.trim(), dept: form.dept, type: form.type,
      tag: form.tag.trim().toUpperCase(), serial: form.serial.trim() || null, date: form.date,
    });
  };

  return (
    <div className="modal-root" data-screen-label="Assign equipment modal">
      <div className="drawer-scrim scrim-visible" onClick={onClose}></div>
      <form className="modal" onSubmit={submit}>
        <header className="modal-head">
          <div>
            <h2 className="modal-title">Assign equipment</h2>
            <p className="modal-sub">Record a new device assignment</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Icon.x /></button>
        </header>
        <div className="modal-body">
          <Field label="Employee name" error={errors.name}>
            <input ref={firstRef} className={'input' + (errors.name ? ' input-err' : '')} placeholder="e.g. Jordan" value={form.name} onChange={set('name')} />
          </Field>
          <div className="field-row">
            <Field label="Department">
              <select className="input" value={form.dept} onChange={set('dept')}>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Equipment type">
              <select className="input" value={form.type} onChange={set('type')}>
                {['Desktop', 'Laptop', 'Mac Mini', 'Monitor', 'IP Phone'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label="Asset ID" error={errors.tag}>
              <input className={'input mono' + (errors.tag ? ' input-err' : '')} placeholder="TS-PC-201" value={form.tag} onChange={set('tag')} />
            </Field>
            <Field label="Serial number">
              <input className="input mono" placeholder="Optional" value={form.serial} onChange={set('serial')} />
            </Field>
          </div>
          <Field label="Assigned date" error={errors.date}>
            <input className="input" type="date" value={form.date} onChange={set('date')} />
          </Field>
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Assign equipment</button>
        </footer>
      </form>
    </div>
  );
}

Object.assign(window, { AssetDrawer, AssignModal });
