import { render } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app.jsx';
import { PayPage } from './ui/PayPage.jsx';
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

// /p is the public page a parent opens from a reminder's payment link. It runs
// without the app, its database or a service worker.
const isPayPage = ['/p', '/pay'].includes(window.location.pathname.replace(/\/+$/, '')); // /pay = links sent by the first release

render(isPayPage ? <PayPage /> : <Root />, document.getElementById('app'));
