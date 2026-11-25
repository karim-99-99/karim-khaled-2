import { useEffect, useState } from "react";

/** Subject mark in its real colors. A missing file shows the subject name. */
export default function HeaderLogo({ src, name }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <span className="logo-fallback">{name}</span>;
  }

  return (
    <img
      src={src}
      alt={name || ""}
      onError={() => setFailed(true)}
    />
  );
}
