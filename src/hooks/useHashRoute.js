import { useEffect, useState, useCallback } from 'react';

// Tiny hash-based router. Avoids pulling in react-router for one screen of
// navigation. Routes look like: #/host/ABC123 or #/play/ABC123.
function parse() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  const [pathRaw, queryRaw = ''] = hash.split('?');
  const segments = pathRaw.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryRaw));
  return { path: '/' + segments.join('/'), segments, query };
}

export function useHashRoute() {
  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const handler = () => setRoute(parse());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((to) => {
    if (!to.startsWith('#')) to = '#' + (to.startsWith('/') ? to : '/' + to);
    if (window.location.hash === to) {
      // Force re-render even when navigating to current hash.
      setRoute(parse());
    } else {
      window.location.hash = to;
    }
  }, []);

  return { ...route, navigate };
}
