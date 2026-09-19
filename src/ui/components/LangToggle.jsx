import { useUi } from '../../state/ui.jsx';

export function LangToggle({ dark }) {
  const { state, setLang } = useUi();
  return (
    <div class={`lang-toggle${dark ? ' dark' : ''}`} role="group" aria-label="Language">
      <button class={state.lang === 'hi' ? 'active' : ''} onClick={() => setLang('hi')}>Hinglish</button>
      <button class={state.lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>English</button>
    </div>
  );
}
