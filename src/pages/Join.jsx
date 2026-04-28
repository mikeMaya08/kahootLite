import React, { useEffect, useState } from 'react';
import { useHashRoute } from '../hooks/useHashRoute';
import { useRoom } from '../hooks/useRoom';
import {
  getOrCreatePlayerId,
  loadPrefs,
  savePrefs,
} from '../utils/storage';

const EMOJI_POOL = ['🦊', '🐼', '🐯', '🦄', '🐙', '🐸', '🐶', '🐱', '🐵', '🐧', '🦁', '🐢'];

function pickEmoji() {
  return EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)];
}

export default function Join() {
  const { segments, navigate } = useHashRoute();
  const code = segments[1];
  const [room, updateRoom] = useRoom(code);
  const [name, setName] = useState(() => loadPrefs().name ?? '');
  const [emoji, setEmoji] = useState(pickEmoji);
  const [error, setError] = useState('');

  // Once the host starts the game, jump every joined player to the play screen.
  useEffect(() => {
    if (!room) return;
    if (room.status !== 'lobby' && room.status !== 'finished') {
      const myId = sessionStorage.getItem('kahootlite:playerId');
      if (myId && room.players?.[myId]) {
        navigate(`/play/${code}`);
      }
    }
  }, [room, code, navigate]);

  if (!code) {
    return (
      <div className="center-screen">
        <p>No room code provided.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Home
        </button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="center-screen">
        <h2>Room {code} not found</h2>
        <p className="muted">
          The host may have ended the game, or the PIN is wrong.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          ← Home
        </button>
      </div>
    );
  }

  const handleJoin = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setError('Pick a nickname.');
      return;
    }
    if (trimmed.length > 20) {
      setError('Nickname must be 20 characters or fewer.');
      return;
    }

    const playerId = getOrCreatePlayerId('p');
    let conflict = false;
    updateRoom((cur) => {
      if (!cur) return cur;
      // Disallow same nickname unless reclaiming our own slot.
      const taken = Object.values(cur.players || {}).some(
        (p) => p.name.toLowerCase() === trimmed.toLowerCase() && p.id !== playerId
      );
      if (taken) {
        conflict = true;
        return cur;
      }
      const players = { ...cur.players };
      players[playerId] = {
        id: playerId,
        name: trimmed,
        emoji,
        score: players[playerId]?.score ?? 0,
        answers: players[playerId]?.answers ?? {},
        joinedAt: players[playerId]?.joinedAt ?? Date.now(),
      };
      return { ...cur, players };
    });

    if (conflict) {
      setError('That nickname is already taken in this room.');
      return;
    }

    savePrefs({ ...loadPrefs(), name: trimmed });
    navigate(`/play/${code}`);
  };

  return (
    <div className="join">
      <button className="btn btn-ghost" onClick={() => navigate('/')}>
        ← Home
      </button>

      <div className="card center-card">
        <p className="muted">Joining room</p>
        <div className="big-code">{room.code}</div>
        <p className="muted">{room.quiz.title}</p>

        <form onSubmit={handleJoin} className="join-form column">
          <label className="field">
            <span>Your nickname</span>
            <input
              type="text"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              placeholder="QuizMaster42"
              autoFocus
            />
          </label>

          <div className="field">
            <span>Avatar</span>
            <div className="emoji-row">
              {EMOJI_POOL.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`emoji-chip ${e === emoji ? 'is-selected' : ''}`}
                  onClick={() => setEmoji(e)}
                  aria-label={`Pick ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="alert">{error}</div>}

          <button className="btn btn-primary big full" type="submit">
            Join game →
          </button>
        </form>
      </div>
    </div>
  );
}
