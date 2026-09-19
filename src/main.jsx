import { render } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app.jsx';
import './styles/global.css';

function Root() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateFnRef = useRef(null);

  useEffect(() => {
    updateFnRef.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      }
    });
  }, []);

  const onRefresh = useCallback(() => {
    updateFnRef.current?.(true);
  }, []);

  return <App needRefresh={needRefresh} onRefresh={onRefresh} />;
}

render(<Root />, document.getElementById('app'));
