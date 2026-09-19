import { useUi } from '../../state/ui.jsx';
import { LANGUAGE_LABEL } from '../../lib/languages.js';

export function LangToggle({ dark }) {
  const { state, setLang } = useUi();
  return (
    <div class={`lang-toggle${dark ? ' dark' : ''}`} role="group" aria-label="Language">
      <button class={state.lang === 'hi' ? 'active' : ''} onClick={() => setLang('hi')}>{LANGUAGE_LABEL.hindi}</button>
      <button class={state.lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>English</button>
    </div>
  );
}
