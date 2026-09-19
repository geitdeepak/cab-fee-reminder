import { useUi } from '../../state/ui.jsx';

// FR-10 / 6.6: reachable within two taps, works fully offline, colour is
// never the only signal (the label text always accompanies it).
export function SafetyCard({ student }) {
  const { t } = useUi();
  return (
    <div style="background:var(--color-accent);color:#fff;padding:14px;border-bottom:2px solid var(--color-text)">
      <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;opacity:.9">{t('safetyCard')}</div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:8px 16px;margin-top:10px;align-items:baseline">
        <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;opacity:.85">{t('bloodGroup')}</div>
        <div style="font-weight:800;font-size:19px;line-height:1">{student.blood_group || 'Unknown'}</div>
        <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;opacity:.85">{t('allergies')}</div>
        <div style="font-weight:700;font-size:14px;line-height:1.35">{student.allergies || '—'}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:13px;padding-top:12px;border-top:2px solid rgba(255,255,255,.4)">
        <a href={`tel:+91${student.emergency_phone}`} style="flex:1;border:2px solid #fff;color:#fff;padding:9px 10px;font-weight:700;font-size:12.5px;display:block;min-height:44px;box-sizing:border-box;text-decoration:none">
          <span style="display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.9">{t('emergency')}</span>
          <span style="display:block;margin-top:2px">{student.emergency_phone}</span>
        </a>
        <a href={`tel:+91${student.father_phone}`} style="flex:1;border:2px solid #fff;color:#fff;padding:9px 10px;font-weight:700;font-size:12.5px;display:block;min-height:44px;box-sizing:border-box;text-decoration:none">
          <span style="display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.9">{t('father')}</span>
          <span style="display:block;margin-top:2px">{student.father_phone || '—'}</span>
        </a>
        <a href={`tel:+91${student.mother_phone}`} style="flex:1;border:2px solid #fff;color:#fff;padding:9px 10px;font-weight:700;font-size:12.5px;display:block;min-height:44px;box-sizing:border-box;text-decoration:none">
          <span style="display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.9">{t('mother')}</span>
          <span style="display:block;margin-top:2px">{student.mother_phone || '—'}</span>
        </a>
      </div>
    </div>
  );
}
