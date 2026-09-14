import katex from "katex";
import "katex/dist/katex.min.css";
import { parseTextDirection } from "../utils/textDirection";

/**
 * Renders text that may contain inline LaTeX wrapped in $...$.
 */
export default function MathText({ children, className }) {
  const { body } = parseTextDirection(children || "");
  const parts = String(body).split(/(\$[^$]*\$)/g);
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
              <span
                key={i}
                dir="ltr"
                style={{ unicodeBidi: "isolate" }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
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
