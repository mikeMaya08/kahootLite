import React, { useCallback, useEffect, useMemo } from 'react';
import AnswerOption from '../components/AnswerOption';
import Leaderboard from '../components/Leaderboard';
import Timer from '../components/Timer';
import { useHashRoute } from '../hooks/useHashRoute';
import { useRoom } from '../hooks/useRoom';
import { computePoints } from '../utils/scoring';
import { deleteRoom } from '../utils/storage';

export default function Host() {
  const { segments, navigate } = useHashRoute();
  const code = segments[1];
  const [room, updateRoom] = useRoom(code);

  // Verify this tab is the legitimate host. Any other tab on /host/CODE
  // can only spectate — they don't have the host token. This stops a
  // second tab from accidentally controlling the game.
  const hostToken = code
    ? sessionStorage.getItem(`kahootlite:hostFor:${code}`)
    : null;
  const isHost = !!room && hostToken && room.hostId === hostToken;

  if (!room) {
    return (
      <div className="center-screen">
        <p>Room not found.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Home
        </button>
      </div>
    );
  }

  const players = Object.values(room.players || {});
  const playersById = room.players || {};
  const total = room.quiz.questions.length;
  const qIndex = room.currentQuestion;
  const currentQ = qIndex >= 0 ? room.quiz.questions[qIndex] : null;

  const startGame = () => {
    if (Object.keys(room.players || {}).length === 0) {
      if (!confirm('No players have joined yet. Start anyway?')) return;
    }
    advanceTo(0);
  };

  const advanceTo = useCallback(
    (next) => {
      updateRoom((cur) => {
        if (!cur) return cur;
        const q = cur.quiz.questions[next];
        if (!q) {
          return { ...cur, status: 'finished' };
        }
        const now = Date.now();
        return {
          ...cur,
          status: 'playing',
          currentQuestion: next,
          questionStartTime: now,
          questionEndTime: now + q.timeLimit * 1000,
        };
      });
    },
    [updateRoom]
  );

  const goToReveal = useCallback(() => {
    updateRoom((cur) => {
      if (!cur || cur.status !== 'playing') return cur;
      const idx = cur.currentQuestion;
      const q = cur.quiz.questions[idx];
      if (!q) return cur;
      const totalMs = q.timeLimit * 1000;

      // Score everyone for this question. Players who already wrote a
      // tentative answer object get their points; everyone else gets 0.
      const players = { ...cur.players };
      for (const id of Object.keys(players)) {
        const p = players[id];
        const ans = p.answers?.[idx];
        if (!ans) continue;
        if (ans.points != null) continue; // already scored client-side
        const correct = ans.choice === q.correctIndex;
        const remaining = Math.max(0, cur.questionEndTime - ans.answeredAt);
        const points = computePoints({
          correct,
          remainingMs: remaining,
          totalMs,
        });
        players[id] = {
          ...p,
          score: (p.score || 0) + points,
          answers: {
            ...p.answers,
            [idx]: { ...ans, correct, points },
          },
        };
      }
      return { ...cur, status: 'reveal', players };
    });
  }, [updateRoom]);

  const nextQuestion = () => advanceTo(qIndex + 1);

  const restart = () => {
    updateRoom((cur) =>
      cur
        ? {
            ...cur,
            status: 'lobby',
            currentQuestion: -1,
            questionStartTime: null,
            questionEndTime: null,
            players: Object.fromEntries(
              Object.entries(cur.players || {}).map(([id, p]) => [
                id,
                { ...p, score: 0, answers: {} },
              ])
            ),
          }
        : cur
    );
  };

  const endGame = () => {
    if (!confirm('End this game and delete the room?')) return;
    deleteRoom(code);
    navigate('/');
  };

  const answeredCount = useMemo(() => {
    if (!currentQ || qIndex < 0) return 0;
    return players.filter((p) => p.answers?.[qIndex]).length;
  }, [players, qIndex, currentQ]);

  // Render branches by status
  const joinUrl = `${window.location.origin}${window.location.pathname}#/join/${code}`;

  if (!isHost) {
    return (
      <div className="center-screen">
        <h2>Spectator view</h2>
        <p className="muted">
          This tab is not the host. The host controls live in the original
          tab that created room <strong>{code}</strong>.
        </p>
        <Leaderboard players={room.players} />
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          ← Home
        </button>
      </div>
    );
  }

  if (room.status === 'lobby') {
    return (
      <div className="host-lobby">
        <div className="page-header">
          <button className="btn btn-ghost" onClick={endGame}>
            ← End room
          </button>
          <h1>{room.quiz.title}</h1>
        </div>

        <div className="lobby-grid">
          <section className="card lobby-code">
            <p className="muted">Game PIN</p>
            <div className="big-code">{room.code}</div>
            <p className="muted small">
              Players join at <code>#/join/{room.code}</code>
            </p>
            <button
              className="btn btn-ghost small"
              onClick={() => {
                navigator.clipboard?.writeText(joinUrl);
              }}
            >
              Copy join link
            </button>
          </section>

          <section className="card lobby-players">
            <h2>
              Players <span className="badge">{players.length}</span>
            </h2>
            {players.length === 0 ? (
              <p className="muted">
                Waiting for players… open a new tab and go to{' '}
                <code>#/join/{room.code}</code>.
              </p>
            ) : (
              <ul className="player-chips">
                {players.map((p) => (
                  <li key={p.id} className="chip">
                    <span aria-hidden="true">{p.emoji ?? '🙂'}</span> {p.name}
                  </li>
                ))}
              </ul>
            )}
            <button
              className="btn btn-primary full big"
              onClick={startGame}
              disabled={total === 0}
            >
              Start game
            </button>
          </section>
        </div>
      </div>
    );
  }

  if (room.status === 'finished') {
    return (
      <div className="results">
        <h1>🏁 Final results</h1>
        <p className="muted">{room.quiz.title}</p>
        <Leaderboard players={room.players} />
        <div className="row gap center">
          <button className="btn btn-secondary" onClick={restart}>
            Play again
          </button>
          <button className="btn btn-primary" onClick={endGame}>
            End room
          </button>
        </div>
      </div>
    );
  }

  // playing | reveal
  const isReveal = room.status === 'reveal';
  const isLast = qIndex === total - 1;

  return (
    <div className="host-game">
      <header className="game-header">
        <span className="muted">
          Question {qIndex + 1} / {total}
        </span>
        <span className="muted">
          PIN <strong>{room.code}</strong>
        </span>
        <span className="muted">
          Answers <strong>{answeredCount}</strong> / {players.length}
        </span>
      </header>

      <h2 className="question-text">{currentQ.text}</h2>

      {!isReveal && (
        <Timer
          endTime={room.questionEndTime}
          totalMs={currentQ.timeLimit * 1000}
          onExpire={goToReveal}
          label="Time left"
        />
      )}

      <div className="answers-grid">
        {currentQ.options.map((opt, i) => {
          let state = null;
          if (isReveal) {
            state = i === currentQ.correctIndex ? 'correct' : 'wrong';
          }
          return (
            <AnswerOption
              key={i}
              index={i}
              text={opt}
              state={state}
              disabled
            />
          );
        })}
      </div>

      <div className="host-controls row gap center">
        {!isReveal && (
          <>
            <button className="btn btn-secondary" onClick={goToReveal}>
              Reveal answer
            </button>
          </>
        )}
        {isReveal && (
          <>
            <button
              className="btn btn-primary"
              onClick={isLast ? () => advanceTo(total) : nextQuestion}
            >
              {isLast ? 'See final results →' : 'Next question →'}
            </button>
          </>
        )}
      </div>

      {isReveal && (
        <section className="card">
          <h3>Standings</h3>
          <Leaderboard players={room.players} compact />
        </section>
      )}
    </div>
  );
}
