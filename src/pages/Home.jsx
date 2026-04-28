import React, { useState } from 'react';
import { useHashRoute } from '../hooks/useHashRoute';
import { loadQuizzes } from '../utils/storage';

export default function Home() {
  const { navigate } = useHashRoute();
  const [code, setCode] = useState('');
  const quizCount = loadQuizzes().length;

  const handleJoin = (e) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length >= 4) navigate(`/join/${c}`);
  };

  return (
    <div className="home">
      <header className="hero">
        <h1>
          <span className="brand-mark">⚡</span> KahootLite
        </h1>
        <p className="hero-sub">
          A frontend-only, multiplayer quiz arena. Build quizzes, host a
          room, and play across browser tabs in real time.
        </p>
      </header>

      <div className="home-grid">
        <section className="card card-action">
          <h2>Have a code?</h2>
          <p className="muted">Join a live game your host just started.</p>
          <form onSubmit={handleJoin} className="join-form">
            <input
              className="code-input"
              placeholder="ABC123"
              maxLength={8}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/\s/g, ''))
              }
              autoFocus
            />
            <button className="btn btn-primary" type="submit">
              Join game →
            </button>
          </form>
        </section>

        <section className="card card-action">
          <h2>Host a quiz</h2>
          <p className="muted">
            {quizCount > 0
              ? `${quizCount} quiz${quizCount === 1 ? '' : 'zes'} saved on this device.`
              : 'Pick a saved quiz or build a new one to get started.'}
          </p>
          <div className="row gap">
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/quizzes')}
            >
              My quizzes
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/create')}
            >
              + New quiz
            </button>
          </div>
        </section>
      </div>

      <footer className="home-footer muted">
        Tip: open this app in two tabs — host in one, join in the other —
        and watch the cross-tab sync work.
      </footer>
    </div>
  );
}
