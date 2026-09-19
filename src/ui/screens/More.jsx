import { useUi } from '../../state/ui.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { BottomNav } from '../components/BottomNav.jsx';

export function More() {
  const { go, t } = useUi();
  const items = [
    { label: t('pickups'), sub: t('moreSubPickups'), screen: 'pickups' },
    { label: t('importStudents'), sub: t('moreSubImport'), screen: 'import' },
    { label: t('invoices'), sub: t('moreSubInvoices'), screen: 'invoices' },
    { label: t('templates'), sub: t('moreSubTemplates'), screen: 'templates' },
    { label: t('reports'), sub: t('moreSubReports'), screen: 'reports' },
    { label: t('backup'), sub: t('moreSubBackup'), screen: 'backup' },
    { label: t('settings'), sub: t('moreSubSettings'), screen: 'settings' }
  ];
  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('more')} />
      <div class="main-scroll scr">
        {items.map((m) => (
          <button key={m.screen} class="list-row" onClick={() => go(m.screen)}>
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
