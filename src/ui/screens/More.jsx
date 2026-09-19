import { useUi } from '../../state/ui.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { BottomNav } from '../components/BottomNav.jsx';

export function More() {
  const { go, t } = useUi();
  const items = [
    { code: 'S-07', label: t('pickups'), sub: 'Fare master', screen: 'pickups' },
    { code: 'NEW', label: t('importStudents'), sub: 'Excel / Google Sheets / CSV', screen: 'import' },
    { code: 'S-09', label: t('invoices'), sub: 'Outstanding and history', screen: 'invoices' },
    { code: 'S-11', label: t('templates'), sub: '5 messages · editable', screen: 'templates' },
    { code: 'S-13', label: t('reports'), sub: 'Collection, defaulters', screen: 'reports' },
    { code: 'S-12', label: t('backup'), sub: 'Export / restore', screen: 'backup' },
    { code: 'S-14', label: t('settings'), sub: 'Profile, due day, escalation', screen: 'settings' }
  ];
  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('more')} />
      <div class="main-scroll scr">
        {items.map((m) => (
          <button key={m.screen} class="list-row" onClick={() => go(m.screen)}>
            <span style="font-size:10px;font-weight:700;color:var(--color-accent-700);flex:0 0 30px">{m.code}</span>
            <span style="flex:1;min-width:0">
              <span style="display:block;font-weight:800;font-size:16px">{m.label}</span>
              <span style="display:block;font-size:11.5px;color:var(--color-neutral-700);margin-top:2px">{m.sub}</span>
            </span>
            <span>&rarr;</span>
          </button>
        ))}
      </div>
      <BottomNav />
    </div>
  );
}
