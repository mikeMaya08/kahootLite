import React, { useState } from 'react';
import AnswerOption from './AnswerOption';

export default function QuizPreview({ quiz, onClose }) {
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);

  const questions = quiz.questions;
  const total = questions.length;
  const done = qIndex >= total;
  const current = done ? null : questions[qIndex];
  const isLast = qIndex === total - 1;
  const answered = selected !== null;

  const selectAnswer = (i) => {
    if (answered) return;
    setSelected(i);
    if (i === current.correctIndex) setCorrectCount((c) => c + 1);
  };

  const advance = () => {
    setSelected(null);
    setQIndex((i) => i + 1);
  };

  return (
    <div className="modal-overlay">
      <div className="card modal-card preview-card">
        <div className="page-header">
          <button className="btn btn-ghost" onClick={onClose}>
            ✕ Close preview
          </button>
          {!done && (
            <span className="muted">
              Q {qIndex + 1} / {total}
            </span>
          )}
        </div>

        {done ? (
          <div className="center-screen">
            <h2>Preview results</h2>
            <p className="muted">
              You got {correctCount} / {total} correct
            </p>
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="question-text">{current.text || 'Untitled question'}</h2>

            <div className="answers-grid">
              {current.options.map((opt, i) => {
                let state = null;
                if (answered) {
                  if (i === current.correctIndex) state = 'correct';
                  else if (i === selected) state = 'wrong';
                }
                return (
                  <AnswerOption
                    key={i}
                    index={i}
                    text={opt}
                    selected={selected === i}
                    state={state}
                    disabled={answered}
                    onSelect={selectAnswer}
                  />
                );
              })}
            </div>

            {answered && (
              <div className="row gap center preview-actions">
                <button className="btn btn-primary" onClick={advance}>
                  {isLast ? 'See results →' : 'Next question →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
