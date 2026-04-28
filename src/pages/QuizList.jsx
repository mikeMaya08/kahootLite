import React, { useEffect, useRef, useState } from 'react';
import { useHashRoute } from '../hooks/useHashRoute';
import { generateId, generateRoomCode } from '../utils/id';
import {
  deleteQuiz,
  getQuiz,
  loadQuizzes,
  loadRoom,
  saveRoom,
} from '../utils/storage';

function createRoom(quiz) {
  // Probability of collision is microscopic, but loop just in case the user
  // somehow ends up with two saved rooms sharing a code.
  let code = generateRoomCode();
  while (loadRoom(code)) code = generateRoomCode();

  const hostId = generateId('host');
  const room = {
    code,
    hostId,
    quiz,
    status: 'lobby', // lobby | playing | reveal | finished
    currentQuestion: -1,
    questionStartTime: null,
    questionEndTime: null,
    players: {},
    createdAt: Date.now(),
  };
  saveRoom(code, room);
  // Stash the host identity for this tab so the host page knows it owns the room.
  sessionStorage.setItem(`kahootlite:hostFor:${code}`, hostId);
  return code;
}

export default function QuizList() {
  const { navigate, query } = useHashRoute();
  const [quizzes, setQuizzes] = useState(() => loadQuizzes());
  // StrictMode runs effects twice in dev — guard so we don't create two rooms.
  const handledHostRef = useRef(null);

  useEffect(() => {
    if (query.host && handledHostRef.current !== query.host) {
      handledHostRef.current = query.host;
      const quiz = getQuiz(query.host);
      if (quiz) {
        const code = createRoom(quiz);
        navigate(`/host/${code}`);
      }
    }
  }, [query.host, navigate]);

  const refresh = () => setQuizzes(loadQuizzes());

  const handleDelete = (id) => {
    if (!confirm('Delete this quiz? This cannot be undone.')) return;
    deleteQuiz(id);
    refresh();
  };

  const handleHost = (quiz) => {
    const code = createRoom(quiz);
    navigate(`/host/${code}`);
  };

  return (
    <div className="quizlist">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          ← Home
        </button>
        <h1>My quizzes</h1>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/create')}
        >
          + New quiz
        </button>
      </div>

      {quizzes.length === 0 ? (
        <div className="card empty">
          <p>No quizzes yet.</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/create')}
          >
            Build your first quiz
          </button>
        </div>
      ) : (
        <ul className="quiz-cards">
          {quizzes.map((q) => (
            <li key={q.id} className="card quiz-card">
              <div>
                <h3>{q.title || 'Untitled quiz'}</h3>
                <p className="muted">
                  {q.questions.length} question
                  {q.questions.length === 1 ? '' : 's'} · updated{' '}
                  {new Date(q.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="row gap">
                <button
                  className="btn btn-ghost"
                  onClick={() => navigate(`/edit/${q.id}`)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-ghost danger"
                  onClick={() => handleDelete(q.id)}
                >
                  Delete
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleHost(q)}
                >
                  Host →
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
