import { useEffect, useState } from "react";
import client from "../api/client";
import { getSubjectTheme, resolveSubjectKey } from "./subjects";

const CACHE_KEY = "zad_subjects_cache_v1";

function readCached(subjectId) {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw);
    return (list || []).find((s) => String(s.id) === String(subjectId)) || null;
  } catch {
    return null;
  }
}

/** Resolve subject name + theme colors/logo for course pages. */
export default function useSubjectSkin(subjectId) {
  const [subject, setSubject] = useState(() =>
    subjectId ? readCached(subjectId) : null
  );

  useEffect(() => {
    if (!subjectId) {
      setSubject(null);
      return undefined;
    }
    const cached = readCached(subjectId);
    if (cached) setSubject(cached);

    let cancelled = false;
    client
      .get(`/subjects/${subjectId}/`)
      .then((res) => {
        if (!cancelled) setSubject(res.data);
      })
      .catch(() => {
        if (cached || cancelled) return;
        client.get("/subjects/").then((res) => {
          if (cancelled) return;
          const list = res.data.results || res.data || [];
          setSubject(list.find((s) => String(s.id) === String(subjectId)) || null);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const key = resolveSubjectKey(subject);
  const theme = getSubjectTheme(key);
  const color = theme?.color || "var(--blue)";
  const soft = theme?.soft || "var(--primary-light)";
  const dark = theme?.dark || "var(--navy)";
  const skin = {
    "--g": color,
    "--gd": dark,
    "--gl": soft,
    "--gl2": soft,
    "--gb": soft,
    "--y": color,
    "--yd": dark,
  };

  return {
    subject,
    subjectName: subject?.name || "…",
    key,
    theme,
    logo: theme?.logo || "/maram-real.png",
    skin,
  };
}
