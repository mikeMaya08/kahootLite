import React from 'react';

const SHAPES = [
  { label: 'A', symbol: '▲', color: 'red' },
  { label: 'B', symbol: '◆', color: 'blue' },
  { label: 'C', symbol: '●', color: 'yellow' },
  { label: 'D', symbol: '■', color: 'green' },
];

export default function AnswerOption({
  index,
  text,
  onSelect,
  selected,
  disabled,
  state, // 'correct' | 'wrong' | null  — only used in reveal mode
  showText = true,
}) {
  const shape = SHAPES[index % SHAPES.length];
  const classes = [
    'answer',
    `answer-${shape.color}`,
    selected ? 'answer-selected' : '',
    state === 'correct' ? 'answer-correct' : '',
    state === 'wrong' ? 'answer-wrong' : '',
    disabled ? 'answer-disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={() => !disabled && onSelect?.(index)}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Option ${shape.label}: ${text}`}
    >
      <span className="answer-shape" aria-hidden="true">
        {shape.symbol}
      </span>
      {showText && <span className="answer-text">{text}</span>}
    </button>
  );
}

export { SHAPES };
