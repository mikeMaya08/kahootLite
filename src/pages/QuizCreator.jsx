import React, { useEffect, useState } from 'react';
import QuestionEditor from '../components/QuestionEditor';
import { useHashRoute } from '../hooks/useHashRoute';
import { generateId } from '../utils/id';
import { getQuiz, upsertQuiz } from '../utils/storage';

const blankQuestion = () => ({
  id: generateId('q'),
  text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  timeLimit: 20,
});

const blankQuiz = () => ({
  id: generateId('quiz'),
  title: '',
  questions: [blankQuestion()],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export default function QuizCreator() {
  const { segments, navigate } = useHashRoute();
  const editingId = segments[1];
  const [quiz, setQuiz] = useState(blankQuiz);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingId) {
      const existing = getQuiz(editingId);
      if (existing) setQuiz(existing);
    }
  }, [editingId]);

  const updateQuestion = (idx, next) => {
    setQuiz((q) => {
      const questions = [...q.questions];
      questions[idx] = next;
      return { ...q, questions };
    });
  };

  const addQuestion = () =>
    setQuiz((q) => ({ ...q, questions: [...q.questions, blankQuestion()] }));

  const removeQuestion = (idx) =>
    setQuiz((q) => ({
      ...q,
      questions: q.questions.filter((_, i) => i !== idx),
    }));

  const validate = (q) => {
    if (!q.title.trim()) return 'Give your quiz a title.';
    if (q.questions.length === 0) return 'Add at least one question.';
    for (let i = 0; i < q.questions.length; i++) {
      const qu = q.questions[i];
      if (!qu.text.trim()) return `Question ${i + 1} needs text.`;
      const filled = qu.options.filter((o) => o.trim()).length;
      if (filled < 2)
        return `Question ${i + 1} needs at least 2 answer options.`;
      if (!qu.options[qu.correctIndex]?.trim())
        return `Question ${i + 1}'s correct option is empty.`;
    }
    return null;
  };

  const handleSave = (then) => {
    const err = validate(quiz);
    if (err) {
      setError(err);
      return;
    }
    const saved = upsertQuiz({ ...quiz, updatedAt: Date.now() });
    setError('');
    then?.(saved);
  };

  return (
    <div className="creator">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          ← Home
        </button>
        <h1>{editingId ? 'Edit quiz' : 'New quiz'}</h1>
      </div>

      <label className="field">
        <span>Quiz title</span>
        <input
          type="text"
          value={quiz.title}
          onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
          placeholder="World capitals trivia"
        />
      </label>

      <div className="questions-list">
        {quiz.questions.map((qu, i) => (
          <QuestionEditor
            key={qu.id}
            question={qu}
            index={i}
            onChange={(next) => updateQuestion(i, next)}
            onRemove={() => removeQuestion(i)}
            canRemove={quiz.questions.length > 1}
          />
        ))}
      </div>

      <button className="btn btn-secondary full" onClick={addQuestion}>
        + Add question
      </button>

      {error && <div className="alert">{error}</div>}

      <div className="row gap creator-actions">
        <button
          className="btn btn-ghost"
          onClick={() => navigate('/quizzes')}
        >
          Cancel
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => handleSave(() => navigate('/quizzes'))}
        >
          Save quiz
        </button>
        <button
          className="btn btn-primary"
          onClick={() =>
            handleSave((saved) => navigate(`/quizzes?host=${saved.id}`))
          }
        >
          Save &amp; host →
        </button>
      </div>
    </div>
  );
}
