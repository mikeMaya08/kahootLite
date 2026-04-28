import React, { useEffect, useMemo } from 'react';
import AnswerOption from '../components/AnswerOption';
import Leaderboard from '../components/Leaderboard';
import Timer from '../components/Timer';
import { useHashRoute } from '../hooks/useHashRoute';
import { useRoom } from '../hooks/useRoom';
import { computePoints } from '../utils/scoring';

export default function Play() {
  const { segments, navigate } = useHashRoute();
  const code = segments[1];
  const [room, updateRoom] = useRoom(code);
  const playerId = sessionStorage.getItem('kahootlite:playerId');

  // Bounce back to join if we don't have an identity yet.
  useEffect(() => {
    if (room && (!playerId || !room.players?.[playerId])) {
      navigate(`/join/${code}`);
    }
  }, [room, playerId, code, navigate]);

  if (!room) {
    return (
      <div className="center-screen">
        <h2>Room {code} ended</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          ← Home
        </button>
      </div>
    );
  }

  const me = room.players?.[playerId];
  if (!me) return null;

  const total = room.quiz.questions.length;
  const qIndex = room.currentQuestion;
  const currentQ = qIndex >= 0 ? room.quiz.questions[qIndex] : null;
  const myAnswer = currentQ ? me.answers?.[qIndex] : null;

  const submitAnswer = (choice) => {
    if (!currentQ || room.status !== 'playing') return;
    if (Date.now() > room.questionEndTime) return;
    // Read-modify-write so we don't trample concurrent host writes.
    updateRoom((cur) => {
      if (!cur) return cur;
      const player = cur.players?.[playerId];
      if (!player) return cur;
      // One answer per question — first one wins.
      if (player.answers?.[qIndex]) return cur;

      const q = cur.quiz.questions[qIndex];
      const correct = choice === q.correctIndex;
      const totalMs = q.timeLimit * 1000;
      const remaining = Math.max(0, cur.questionEndTime - Date.now());
      const points = computePoints({
        correct,
        remainingMs: remaining,
        totalMs,
      });

      return {
        ...cur,
        players: {
          ...cur.players,
          [playerId]: {
            ...player,
            score: (player.score || 0) + points,
            answers: {
              ...player.answers,
              [qIndex]: {
                choice,
                correct,
                points,
                answeredAt: Date.now(),
              },
            },
          },
        },
      };
    });
  };

  const otherAnsweredCount = useMemo(() => {
    if (!currentQ) return 0;
    return Object.values(room.players || {}).filter(
      (p) => p.answers?.[qIndex]
    ).length;
  }, [room.players, qIndex, currentQ]);

  if (room.status === 'lobby') {
    return (
      <div className="center-screen">
        <div className="card center-card">
          <p className="muted">You're in!</p>
          <div className="big-code">{room.code}</div>
          <p>
            <span className="emoji-big">{me.emoji}</span>
            <strong className="player-name">{me.name}</strong>
          </p>
          <p className="muted">Waiting for the host to start…</p>
          <div className="loading-dots">
            <span /> <span /> <span />
          </div>
        </div>
      </div>
    );
  }

  if (room.status === 'finished') {
    const ranked = Object.values(room.players || {}).sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );
    const myRank = ranked.findIndex((p) => p.id === playerId) + 1;
    return (
      <div className="results">
        <h1>🏁 Game over</h1>
        <p className="muted">{room.quiz.title}</p>
        <div className="card center-card you-card">
          <p>You finished</p>
          <div className="big-code">#{myRank}</div>
          <p className="muted">
            {me.name} · {me.score} pts
          </p>
        </div>
        <Leaderboard players={room.players} highlightId={playerId} />
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          ← Home
        </button>
      </div>
    );
  }

  const isReveal = room.status === 'reveal';

  return (
    <div className="play">
      <header className="game-header">
        <span className="muted">
          Q {qIndex + 1} / {total}
        </span>
        <span className="muted">
          <span aria-hidden="true">{me.emoji}</span> {me.name}
        </span>
        <span className="muted">
          <strong>{me.score}</strong> pts
        </span>
      </header>

      <h2 className="question-text">{currentQ.text}</h2>

      {!isReveal && (
        <Timer
          endTime={room.questionEndTime}
          totalMs={currentQ.timeLimit * 1000}
          label="Answer in"
        />
      )}

      {!isReveal && !myAnswer && (
        <p className="muted center small">
          {otherAnsweredCount}/{Object.keys(room.players).length} have
          answered
        </p>
      )}

      <div className="answers-grid">
        {currentQ.options.map((opt, i) => {
          let state = null;
          if (isReveal) {
            if (i === currentQ.correctIndex) state = 'correct';
            else if (myAnswer?.choice === i) state = 'wrong';
          }
          return (
            <AnswerOption
              key={i}
              index={i}
              text={opt}
              selected={myAnswer?.choice === i}
              state={state}
              disabled={!!myAnswer || isReveal}
              onSelect={submitAnswer}
            />
          );
        })}
      </div>

      {!isReveal && myAnswer && (
        <p className="center muted">
          Locked in. Waiting for other players…
        </p>
      )}

      {isReveal && (
        <section className="card reveal-card">
          {myAnswer ? (
            myAnswer.correct ? (
              <h3 className="text-correct">
                ✓ Correct! +{myAnswer.points} pts
              </h3>
            ) : (
              <h3 className="text-wrong">✗ Not this time.</h3>
            )
          ) : (
            <h3 className="text-wrong">⏱ Out of time.</h3>
          )}
          <Leaderboard players={room.players} highlightId={playerId} compact />
        </section>
      )}
    </div>
  );
}
