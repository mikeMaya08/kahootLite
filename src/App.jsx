import React, { useEffect } from 'react';
import { useHashRoute } from './hooks/useHashRoute';
import Home from './pages/Home';
import QuizCreator from './pages/QuizCreator';
import QuizList from './pages/QuizList';
import Host from './pages/Host';
import Join from './pages/Join';
import Play from './pages/Play';
import { loadPrefs, savePrefs } from './utils/storage';

function ThemeToggle() {
  const prefs = loadPrefs();
  const dark = prefs.theme !== 'light';

  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    savePrefs({ ...prefs, theme: next });
    document.documentElement.dataset.theme = next;
    // Trigger a tiny re-render of consumers reading prefs.
    window.dispatchEvent(new Event('kahootlite:prefs'));
  };

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}

export default function App() {
  const { segments } = useHashRoute();
  const [, force] = React.useReducer((x) => x + 1, 0);

  // Apply persisted theme on mount + any time the toggle fires.
  useEffect(() => {
    const apply = () => {
      const t = loadPrefs().theme ?? 'dark';
      document.documentElement.dataset.theme = t;
      force();
    };
    apply();
    window.addEventListener('kahootlite:prefs', apply);
    return () => window.removeEventListener('kahootlite:prefs', apply);
  }, []);

  let page;
  switch (segments[0]) {
    case 'create':
      page = <QuizCreator />;
      break;
    case 'edit':
      page = <QuizCreator />;
      break;
    case 'quizzes':
      page = <QuizList />;
      break;
    case 'host':
      page = <Host />;
      break;
    case 'join':
      page = <Join />;
      break;
    case 'play':
      page = <Play />;
      break;
    default:
      page = <Home />;
  }

  return (
    <div className="app-shell">
      <ThemeToggle />
      <main className="app-main">{page}</main>
    </div>
  );
}
