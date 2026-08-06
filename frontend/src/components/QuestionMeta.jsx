const LEVEL_LABELS = {
  easy: "سهل",
  medium: "متوسط",
  hard: "صعب",
};

/**
 * Meta chips shown above a collection/exam question:
 * difficulty · subject · lesson (تجميع) · optional year
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
    level && { key: "level", label: "المستوى", value: level },
    subjectName && { key: "subject", label: "المادة", value: subjectName },
    lessonTitle && { key: "lesson", label: "التجميع", value: lessonTitle },
    year && { key: "year", label: "السنة", value: year },
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <div className="question-meta" aria-label="بيانات السؤال">
      {parts.map((p) => (
        <span key={p.key} className="question-meta__chip">
          <span className="question-meta__label">{p.label}</span>
          <span className="question-meta__value">{p.value}</span>
        </span>
      ))}
    </div>
  );
}
