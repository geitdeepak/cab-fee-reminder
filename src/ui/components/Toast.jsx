import { useUi } from '../../state/ui.jsx';

export function Toast() {
  const { state } = useUi();
  if (!state.toast) return null;
  return <div class="toast">{state.toast}</div>;
}
