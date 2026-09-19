import { createContext } from 'preact';
import { useContext, useReducer, useCallback, useRef, useEffect } from 'preact/hooks';
import { t as translate } from './strings.js';
import { getSettingsMap, setSetting } from '../actions/settings.js';

const UiContext = createContext(null);

const initialState = {
  screen: 'boot',
  stack: [],
  params: {},
  lang: 'hi',
  locked: true,
  toast: null,
  dialog: null
};

function reducer(state, action) {
  switch (action.type) {
    case 'GO':
      return { ...state, screen: action.screen, params: action.params || {}, stack: state.stack.concat([{ screen: state.screen, params: state.params }]) };
    case 'BACK': {
      if (!state.stack.length) return { ...state, screen: 'dash', params: {} };
      const prev = state.stack[state.stack.length - 1];
      return { ...state, screen: prev.screen, params: prev.params, stack: state.stack.slice(0, -1) };
    }
    case 'ROOT':
      return { ...state, screen: action.screen, params: action.params || {}, stack: [] };
    case 'SET_LANG':
      return { ...state, lang: action.lang };
    case 'LOCK':
      return { ...state, locked: true, screen: 'lock', stack: [] };
    case 'UNLOCK':
      return { ...state, locked: false, screen: 'dash', stack: [] };
    case 'BOOT_DONE':
      // Language is set independently by the settings-loading effect below;
      // this case must not clobber it back to undefined.
      return { ...state, screen: action.needsSetup ? 'setup' : 'lock' };
    case 'TOAST':
      return { ...state, toast: action.message };
    case 'DIALOG':
      return { ...state, dialog: action.dialog };
    default:
      return state;
  }
}

export function UiProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const toastTimer = useRef(null);
  const bgTimer = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    getSettingsMap().then((s) => {
      if (!cancelled) dispatch({ type: 'SET_LANG', lang: s.language || 'hi' });
    });
    return () => { cancelled = true; };
  }, []);

  const go = useCallback((screen, params) => dispatch({ type: 'GO', screen, params }), []);
  const back = useCallback(() => dispatch({ type: 'BACK' }), []);
  const root = useCallback((screen, params) => dispatch({ type: 'ROOT', screen, params }), []);
  const lock = useCallback(() => dispatch({ type: 'LOCK' }), []);
  const unlock = useCallback(() => dispatch({ type: 'UNLOCK' }), []);
  const bootDone = useCallback((needsSetup) => dispatch({ type: 'BOOT_DONE', needsSetup }), []);

  const setLang = useCallback((lang) => {
    dispatch({ type: 'SET_LANG', lang });
    setSetting('language', lang);
  }, []);

  const toast = useCallback((message) => {
    clearTimeout(toastTimer.current);
    dispatch({ type: 'TOAST', message });
    toastTimer.current = setTimeout(() => dispatch({ type: 'TOAST', message: null }), 2600);
  }, []);

  const showDialog = useCallback((dialog) => dispatch({ type: 'DIALOG', dialog }), []);
  const closeDialog = useCallback(() => dispatch({ type: 'DIALOG', dialog: null }), []);

  // FR-12: re-lock after 5 minutes in the background.
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        bgTimer.current = Date.now();
      } else if (bgTimer.current) {
        const elapsed = Date.now() - bgTimer.current;
        bgTimer.current = null;
        if (elapsed > 5 * 60 * 1000 && !state.locked) lock();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [state.locked, lock]);

  // The phone's own back button / swipe. An installed app has no browser history of its own, so
  // without this the first back press would close the app from any screen. We keep one spare
  // history entry behind the app; when the phone goes "back" onto it we do the in-app back step
  // and put the spare entry back. Only from Home (or the lock screen) is the app allowed to close.
  useEffect(() => {
    history.replaceState({ cabfee: 'base' }, '');
    history.pushState({ cabfee: 'guard' }, '');
    const rearm = () => history.pushState({ cabfee: 'guard' }, '');

    function onPop() {
      const s = stateRef.current;
      if (s.dialog) {
        dispatch({ type: 'DIALOG', dialog: null });
        rearm();
      } else if (s.stack.length > 0) {
        dispatch({ type: 'BACK' });
        rearm();
      } else if (!['dash', 'lock', 'setup', 'boot'].includes(s.screen)) {
        dispatch({ type: 'ROOT', screen: 'dash' });
        rearm();
      } else {
        history.back(); // already at Home: let the phone leave the app
      }
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const tr = useCallback((key) => translate(state.lang, key), [state.lang]);

  const value = { state, go, back, root, lock, unlock, bootDone, setLang, toast, showDialog, closeDialog, t: tr };
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside UiProvider');
  return ctx;
}
