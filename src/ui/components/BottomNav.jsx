import { useUi } from '../../state/ui.jsx';
import { usePendingReminderCount } from '../../state/hooks.js';

export function BottomNav() {
  const { state, root, t } = useUi();
  const pendingCount = usePendingReminderCount();

  const items = [
    { key: 'dash', glyph: '▣', label: t('home') },
    { key: 'queue', glyph: '➤', label: t('queue'), badge: pendingCount },
    { key: 'students', glyph: '☰', label: t('students') },
    { key: 'invoices', glyph: '₹', label: t('money') },
    { key: 'more', glyph: '⋯', label: t('more') }
  ];

  return (
    <div class="bottom-nav">
      {items.map((item) => (
        <button
          key={item.key}
          class={`nav-btn${state.screen === item.key || (state.screen === 'student' && item.key === 'students') ? ' active' : ''}`}
          onClick={() => root(item.key)}
        >
          <span class="nav-glyph">{item.glyph}</span>
          <span class="nav-label">{item.label}</span>
          {!!item.badge && <span class="nav-badge">{item.badge}</span>}
        </button>
      ))}
    </div>
  );
}
