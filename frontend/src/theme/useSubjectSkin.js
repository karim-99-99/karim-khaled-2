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

  const key = resolveSubjectKey(subject?.name) || "math";
  const theme = getSubjectTheme(key);
  const color = theme?.color || "#156eb0";
  const soft = theme?.soft || "#e8f3fb";
  const darkByKey = {
    math: "#3f6a1f",
    physics: "#4c1d95",
    chem: "#8f1022",
    bio: "#8a6100",
    multi: "#0d467d",
  };
  const soft2ByKey = {
    math: "#d7e8c2",
    physics: "#e9defd",
    chem: "#fde3e6",
    bio: "#fdeec0",
    multi: "#d6eaf8",
  };
  const lineByKey = {
    math: "#e7ecdf",
    physics: "#ece8f5",
    chem: "#f3e4e6",
    bio: "#f1e8d2",
    multi: "#edf0f6",
  };
  const skin = {
    "--g": color,
    "--gd": darkByKey[key] || color,
    "--gl": soft,
    "--gl2": soft2ByKey[key] || soft,
    "--gb": soft2ByKey[key] || soft,
    "--line": lineByKey[key] || "#edf0f6",
    "--mu": "#6b7280",
    "--y": color,
    "--yd": darkByKey[key] || color,
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
