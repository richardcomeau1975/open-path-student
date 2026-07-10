'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { apiFetch } from '../../../../../lib/api';
import Header from '../../../../../components/Header';
import BackButton from '../../../../../components/BackButton';

export default function V3TestMe() {
  const { courseId, topicId } = useParams();
  const { getToken, isLoaded } = useAuth();
  const [questions, setQuestions] = useState(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      try {
        const token = await getToken();
        const data = await apiFetch(`/api/topics/${topicId}/quiz`, {}, token);
        setQuestions(data.questions || []);
      } catch (e) {
        setError('The questions are still being prepared — try again in a minute.');
      }
    })();
  }, [isLoaded, topicId]);

  const q = questions?.[idx];
  const done = questions && idx >= questions.length;

  function choose(optionIdx) {
    if (revealed) return;
    setPicked(optionIdx);
    setRevealed(true);
    // quiz.json shape: options is an array of "A) ..." strings, correct is the letter
    const correct = 'ABCD'.indexOf(q.correct);
    if (optionIdx === correct) setScore((s) => s + 1);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fdfbf7', color: '#1a1a1a' }}>
      <Header />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        <BackButton href={`/v3/${courseId}/${topicId}`} />
        <h1 style={{ fontFamily: "var(--font-display), 'Lora', serif", fontSize: 24, fontWeight: 600, margin: '16px 0 20px' }}>
          Test Me
        </h1>

        {error && <p style={{ color: '#6B6B6B' }}>{error}</p>}
        {!questions && !error && <p style={{ color: '#9B8E82' }}>Loading questions…</p>}

        {done && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{score} / {questions.length}</div>
            <button
              onClick={() => { setIdx(0); setScore(0); setPicked(null); setRevealed(false); }}
              style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: '1px solid #E8E4DA', background: '#fff', cursor: 'pointer', fontSize: 14 }}
            >
              Start over
            </button>
          </div>
        )}

        {q && !done && (
          <div>
            <div style={{ fontSize: 13, color: '#9B8E82', marginBottom: 12 }}>
              Question {idx + 1} of {questions.length}
            </div>
            <div style={{ background: '#fff', border: '1px solid #E8E4DA', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
              <div style={{ fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>{q.question}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(q.options || []).map((opt, i) => {
                  const correct = 'ABCD'.indexOf(q.correct);
                  const isRight = revealed && i === correct;
                  const isWrongPick = revealed && picked === i && i !== correct;
                  return (
                    <div
                      key={i}
                      onClick={() => choose(i)}
                      style={{
                        padding: '12px 14px', borderRadius: 8, cursor: revealed ? 'default' : 'pointer',
                        border: `1px solid ${isRight ? '#4A7C59' : isWrongPick ? '#c0392b' : '#E8E4DA'}`,
                        background: isRight ? '#f0f7f2' : isWrongPick ? '#fdf0ee' : '#fdfbf7',
                        fontSize: 14, lineHeight: 1.5,
                      }}
                    >
                      {opt}
                    </div>
                  );
                })}
              </div>
              {revealed && q.explanation && (
                <div style={{ marginTop: 14, fontSize: 13, color: '#4a4a4a', lineHeight: 1.6, borderTop: '1px solid #E8E4DA', paddingTop: 12 }}>
                  {q.explanation}
                </div>
              )}
            </div>
            {revealed && (
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => { setIdx((i) => i + 1); setPicked(null); setRevealed(false); }}
                  style={{ padding: '12px 32px', borderRadius: 8, border: 'none', background: '#8B6914', color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 500 }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
