import { useUi } from '../../state/ui.jsx';
import { LangToggle } from './LangToggle.jsx';

export function TopBar({ title, eyebrow, right }) {
  const { state, back, t } = useUi();
  const [hh, mm] = [new Date().getHours(), new Date().getMinutes()];
  const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

  return (
    <div class="topbar">
      <div class="topbar-status">
        <span>{clock}</span>
        <span>{t('offline')}</span>
      </div>
      <div class="topbar-main">
        {state.stack.length > 0 && (
          <button class="icon-btn" aria-label="Back" onClick={back}>
            {'←'}
          </button>
        )}
        <div class="topbar-title-wrap">
          {eyebrow && <div class="topbar-eyebrow">{eyebrow}</div>}
          <div class="topbar-title">{title}</div>
        </div>
        {right}
        <LangToggle />
      </div>
    </div>
  );
}
