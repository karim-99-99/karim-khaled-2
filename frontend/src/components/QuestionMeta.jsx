const LEVEL_LABELS = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

/**
 * Meta chips above a question — values only (سهل · رياضيات · درس · سنة).
 */
export default function QuestionMeta({
  difficulty,
  difficultyLabel,
  subjectName,
  lessonTitle,
  questionYear,
}) {
  const level = difficultyLabel || LEVEL_LABELS[difficulty] || difficulty;
  const year = (questionYear || "").trim();
  const parts = [
    level && { key: "level", value: level },
    subjectName && { key: "subject", value: subjectName },
    lessonTitle && { key: "lesson", value: lessonTitle },
    year && { key: "year", value: year },
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <div className="question-meta" aria-label="بيانات السؤال">
      {parts.map((p) => (
        <span key={p.key} className="question-meta__chip">
          <span className="question-meta__value">{p.value}</span>
        </span>
      ))}
    </div>
  );
}
