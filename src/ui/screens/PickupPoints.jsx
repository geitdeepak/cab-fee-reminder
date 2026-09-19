import { useState } from 'preact/hooks';
import { usePickupPoints } from '../../state/hooks.js';
import { useUi } from '../../state/ui.jsx';
import { savePickupPoint, removePickupPoint, countEnrolledAt } from '../../actions/pickups.js';
import { formatCurrency } from '../../lib/format.js';
import { TopBar } from '../components/TopBar.jsx';

export function PickupPoints() {
  const { toast, showDialog, t } = useUi();
  const pickups = usePickupPoints();
  const [sheet, setSheet] = useState(null); // {id, name, area, monthly_fare, distance_km, active} or null
  const [errors, setErrors] = useState({});

  function openNew() {
    setSheet({ id: null, name: '', area: '', monthly_fare: '', distance_km: '', active: true });
    setErrors({});
  }
  function openEdit(p) {
    setSheet({ ...p, monthly_fare: String(p.monthly_fare), distance_km: String(p.distance_km || '') });
    setErrors({});
  }

  async function onSave() {
    try {
      await savePickupPoint(sheet);
      toast(`${sheet.name} ✓`);
      setSheet(null);
    } catch (e) {
      setErrors({ name: /name/i.test(e.message) ? e.message : '', monthly_fare: /fare/i.test(e.message) ? e.message : '' });
    }
  }

  async function onRemove(p) {
    const count = await countEnrolledAt(p.id);
    if (count > 0) {
      showDialog({
        title: 'This point cannot be deleted',
        body: `${p.name} has ${count} student${count === 1 ? '' : 's'} enrolled. Deleting it would break their billing.\n\nMark it inactive instead — it disappears from new enrolments and history stays intact.`,
        confirmLabel: 'Mark inactive',
        onConfirm: async () => {
          await removePickupPoint(p.id);
          toast(`${p.name} is now inactive.`);
        }
      });
      return;
    }
    showDialog({
      title: `Remove ${p.name}?`,
      body: 'No students are enrolled here, so removing it is safe. This cannot be undone.',
      confirmLabel: 'Yes, remove',
      danger: true,
      onConfirm: async () => {
        await removePickupPoint(p.id);
        toast(`${p.name} removed.`);
      }
    });
  }

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('pickups')} eyebrow="S-07" />
      <div class="main-scroll scr">
        <div style="padding:12px 14px;border-bottom:2px solid var(--color-text);background:var(--color-neutral-100);font-size:12px;color:var(--color-neutral-800)">{t('pickupIntro')}</div>
        {pickups.map((p) => (
          <div key={p.id} style={`padding:12px 14px;border-bottom:1px solid var(--color-neutral-300);display:flex;gap:11px;align-items:flex-start;${p.active ? '' : 'opacity:.5'}`}>
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:15.5px">{p.name}</div>
              <div style="font-size:11.5px;color:var(--color-neutral-700);margin-top:2px">{p.area || 'No landmark'} · {p.distance_km || 0} km</div>
              {!p.active && <div class="tag" style="margin-top:5px;color:var(--color-neutral-600)">{t('inactive')}</div>}
            </div>
            <div style="text-align:right;flex:0 0 auto">
              <div style="font-weight:800;font-size:18px">{formatCurrency(p.monthly_fare)}</div>
              <div style="font-size:10px;text-transform:uppercase;color:var(--color-neutral-700);font-weight:700">{t('perMonth')}</div>
              <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:6px">
                <button class="btn btn-ghost" onClick={() => openEdit(p)}>{t('edit')}</button>
                <button class="btn btn-ghost" aria-label="Remove" onClick={() => onRemove(p)}>&#10005;</button>
              </div>
            </div>
          </div>
        ))}
        {pickups.length === 0 && <div class="empty-state">No pickup points yet.</div>}
        <div style="padding:14px;display:flex;flex-direction:column;gap:9px">
          <button class="btn btn-primary btn-block" onClick={openNew}>{t('addPickup')}</button>
          <div style="font-size:11.5px;line-height:1.5;color:var(--color-neutral-700)">{t('fareLockNote')}</div>
        </div>
      </div>

      {sheet && (
        <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && setSheet(null)}>
          <div class="dialog-sheet">
            <div class="dialog-title" style="display:flex;justify-content:space-between;align-items:center">
              <span>{sheet.id ? t('edit') : t('addPickup')}</span>
              <button class="icon-btn" onClick={() => setSheet(null)}>&#10005;</button>
            </div>
            <div style="padding:14px;display:flex;flex-direction:column;gap:13px">
              <div class="field">
                <label>{t('pickupPoint')} *</label>
                <input class="input" value={sheet.name} onInput={(e) => setSheet({ ...sheet, name: e.currentTarget.value })} />
                {errors.name && <div class="field-error">{errors.name}</div>}
              </div>
              <div class="field">
                <label>Area / landmark</label>
                <input class="input" value={sheet.area} onInput={(e) => setSheet({ ...sheet, area: e.currentTarget.value })} />
              </div>
              <div class="field">
                <label>Monthly fare (₹) *</label>
                <input class="input" inputMode="numeric" value={sheet.monthly_fare} onInput={(e) => setSheet({ ...sheet, monthly_fare: e.currentTarget.value.replace(/\D/g, '') })} />
                {errors.monthly_fare && <div class="field-error">{errors.monthly_fare}</div>}
              </div>
              <div class="field">
                <label>Distance (km)</label>
                <input class="input" inputMode="decimal" value={sheet.distance_km} onInput={(e) => setSheet({ ...sheet, distance_km: e.currentTarget.value })} />
              </div>
              <button
                onClick={() => setSheet({ ...sheet, active: !sheet.active })}
                style="display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:11px 0;border:0;border-top:1px solid var(--color-neutral-300);border-bottom:1px solid var(--color-neutral-300);background:transparent"
              >
                <span style="flex:1;font-size:13px;font-weight:700">{sheet.active ? 'Active — offered on new enrolments' : 'Inactive — hidden from new enrolments'}</span>
                <span style={`flex:0 0 46px;width:46px;height:26px;border:2px solid var(--color-text);display:flex;align-items:center;padding:2px;${sheet.active ? 'background:var(--color-accent);justify-content:flex-end' : 'background:var(--color-neutral-300);justify-content:flex-start'}`}>
                  <span style={`display:block;width:18px;height:18px;background:${sheet.active ? '#fff' : 'var(--color-neutral-600)'}`} />
                </span>
              </button>
              <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" onClick={() => setSheet(null)}>{t('cancel')}</button>
                <button class="btn btn-primary" style="flex:1;justify-content:flex-start" onClick={onSave}>{t('save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
