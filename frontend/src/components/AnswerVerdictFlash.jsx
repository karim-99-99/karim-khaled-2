/**
 * Full-screen flash: big ✓ (green) or ✗ (red) after a student answers.
 */
export default function AnswerVerdictFlash({ verdict, onDone }) {
  if (!verdict) return null;
  const ok = verdict === "correct";

  return (
    <div
      className={`answer-verdict ${ok ? "answer-verdict--ok" : "answer-verdict--bad"}`}
      role="status"
      aria-live="polite"
      onClick={onDone}
    >
      <div className="answer-verdict__burst" aria-hidden="true" />
      <div className="answer-verdict__mark" aria-hidden="true">
        {ok ? (
          <svg viewBox="0 0 120 120" className="answer-verdict__svg">
            <circle cx="60" cy="60" r="54" className="answer-verdict__ring" />
            <path
              className="answer-verdict__check"
              d="M34 62 L52 80 L88 42"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 120 120" className="answer-verdict__svg">
            <circle cx="60" cy="60" r="54" className="answer-verdict__ring" />
            <path
              className="answer-verdict__x"
              d="M40 40 L80 80 M80 40 L40 80"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <div className="answer-verdict__label">{ok ? "إجابة صحيحة" : "إجابة خاطئة"}</div>
    </div>
  );
}
