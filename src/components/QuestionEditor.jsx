import React from 'react';
import { SHAPES } from './AnswerOption';

export default function QuestionEditor({
  question,
  index,
  onChange,
  onRemove,
  canRemove,
}) {
  const update = (patch) => onChange({ ...question, ...patch });
  const updateOption = (i, value) => {
    const next = [...question.options];
    next[i] = value;
    update({ options: next });
  };

  return (
    <fieldset className="card question-editor">
      <legend>Question {index + 1}</legend>

      <label className="field">
        <span>Question text</span>
        <textarea
          rows={2}
          value={question.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder="What is the capital of France?"
        />
      </label>

      <div className="grid-2">
        <label className="field">
          <span>Time limit (seconds)</span>
          <input
            type="number"
            min={5}
            max={120}
            value={question.timeLimit}
            onChange={(e) =>
              update({
                timeLimit: Math.max(
                  5,
                  Math.min(120, Number(e.target.value) || 20)
                ),
              })
            }
          />
        </label>
        <label className="field">
          <span>Correct answer</span>
          <select
            value={question.correctIndex}
            onChange={(e) =>
              update({ correctIndex: Number(e.target.value) })
            }
          >
            {SHAPES.map((s, i) => (
              <option key={i} value={i}>
                {s.label} — {question.options[i] || '(empty)'}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="options-grid">
        {question.options.map((opt, i) => (
          <label
            key={i}
            className={`option-input option-${SHAPES[i].color} ${
              question.correctIndex === i ? 'option-correct' : ''
            }`}
          >
            <span className="option-shape">{SHAPES[i].symbol}</span>
            <input
              type="text"
              value={opt}
              placeholder={`Option ${SHAPES[i].label}`}
              onChange={(e) => updateOption(i, e.target.value)}
            />
          </label>
        ))}
      </div>

      {canRemove && (
        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={onRemove}>
            Remove question
          </button>
        </div>
      )}
    </fieldset>
  );
}
