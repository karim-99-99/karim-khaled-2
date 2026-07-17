import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Renders text that may contain inline LaTeX wrapped in $...$.
 * Everything outside $...$ is treated as plain (Arabic) text.
 */
export default function MathText({ children, className }) {
  const text = children || "";
  const parts = String(text).split(/(\$[^$]*\$)/g);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
          const tex = part.slice(1, -1);
          try {
            const html = katex.renderToString(tex, {
              throwOnError: false,
              output: "html",
            });
            return (
              <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
            );
          } catch {
            return <span key={i}>{part}</span>;
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
