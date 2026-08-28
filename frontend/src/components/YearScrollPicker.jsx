import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function yearNum(y) {
  const digits = String(y).replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

/** Expand { start, end } to every year label in that inclusive span. */
export function expandYearRange(allYears, range) {
  if (!range?.start || !range?.end || !allYears?.length) return [];
  const sorted = [...allYears].sort((a, b) => yearNum(a) - yearNum(b));
  const lo = Math.min(yearNum(range.start), yearNum(range.end));
  const hi = Math.max(yearNum(range.start), yearNum(range.end));
  return sorted.filter((y) => {
    const n = yearNum(y);
    return n >= lo && n <= hi;
  });
}

export function isFullYearRange(allYears, range) {
  if (!allYears?.length || !range) return !range;
  const sorted = [...allYears].sort((a, b) => yearNum(a) - yearNum(b));
  return range.start === sorted[0] && range.end === sorted[sorted.length - 1];
}

export function questionCountInRange(yearStats, range, allYears) {
  if (!range || isFullYearRange(allYears, range)) {
    return (yearStats || []).reduce((s, r) => s + (Number(r.total) || 0), 0);
  }
  const allowed = new Set(expandYearRange(allYears, range));
  return (yearStats || [])
    .filter((r) => allowed.has(r.year))
    .reduce((s, r) => s + (Number(r.total) || 0), 0);
}

/**
 * Yellow timeline with two green handles — the span between them is the selected period.
 */
export default function YearScrollPicker({
  years = [],
  value = null,
  onChange,
  yearStats = [],
  emptyMessage = "لا توجد سنوات مسجّلة على الأسئلة بعد.",
}) {
  const railRef = useRef(null);
  const dragHandle = useRef(null);
  const [liveStart, setLiveStart] = useState(null);
  const [liveEnd, setLiveEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const countByYear = useMemo(
    () =>
      Object.fromEntries(
        (yearStats || []).map((row) => [row.year, Number(row.total) || 0])
      ),
    [yearStats]
  );

  const yearList = useMemo(
    () => [...years].sort((a, b) => yearNum(a) - yearNum(b)),
    [years]
  );

  const [startIdx, setStartIdx] = useState(0);
  const [endIdx, setEndIdx] = useState(Math.max(0, yearList.length - 1));

  useEffect(() => {
    if (!yearList.length) return;
    if (!value) {
      setStartIdx(0);
      setEndIdx(yearList.length - 1);
      return;
    }
    const si = yearList.indexOf(value.start);
    const ei = yearList.indexOf(value.end);
    setStartIdx(si >= 0 ? si : 0);
    setEndIdx(ei >= 0 ? ei : yearList.length - 1);
  }, [value, yearList.join(",")]);

  const displayStart = liveStart ?? startIdx;
  const displayEnd = liveEnd ?? endIdx;
  const lo = Math.min(displayStart, displayEnd);
  const hi = Math.max(displayStart, displayEnd);
  const fullRange = yearList.length <= 1 || (lo === 0 && hi === yearList.length - 1);

  const leftPct = yearList.length <= 1 ? 0 : (lo / (yearList.length - 1)) * 100;
  const rightPct = yearList.length <= 1 ? 100 : (hi / (yearList.length - 1)) * 100;

  const pickFromClientX = useCallback(
    (clientX) => {
      const rail = railRef.current;
      if (!rail || yearList.length <= 1) return 0;
      const rect = rail.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return Math.round(ratio * (yearList.length - 1));
    },
    [yearList.length]
  );

  const commitRange = useCallback(
    (nextStart, nextEnd) => {
      const s = Math.min(nextStart, nextEnd);
      const e = Math.max(nextStart, nextEnd);
      setStartIdx(s);
      setEndIdx(e);
      setLiveStart(null);
      setLiveEnd(null);
      setIsDragging(false);
      dragHandle.current = null;

      if (s === 0 && e === yearList.length - 1) {
        onChange?.(null);
      } else {
        onChange?.({ start: yearList[s], end: yearList[e] });
      }
    },
    [yearList, onChange]
  );

  useEffect(() => {
    function onMove(e) {
      if (!dragHandle.current) return;
      const idx = pickFromClientX(e.clientX);
      if (dragHandle.current === "start") {
        setLiveStart(idx);
        setLiveEnd(endIdx);
      } else {
        setLiveStart(startIdx);
        setLiveEnd(idx);
      }
    }
    function onUp(e) {
      if (!dragHandle.current) return;
      const idx = pickFromClientX(e.clientX);
      if (dragHandle.current === "start") {
        commitRange(idx, endIdx);
      } else {
        commitRange(startIdx, idx);
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [pickFromClientX, commitRange, startIdx, endIdx]);

  function onThumbDown(which, e) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragHandle.current = which;
    setIsDragging(true);
    if (which === "start") {
      setLiveStart(startIdx);
      setLiveEnd(endIdx);
    } else {
      setLiveStart(startIdx);
      setLiveEnd(endIdx);
    }
  }

  function onRailPointerDown(e) {
    if (yearList.length <= 1) return;
    const idx = pickFromClientX(e.clientX);
    const startPct = yearList.length <= 1 ? 0 : startIdx / (yearList.length - 1);
    const endPct = yearList.length <= 1 ? 1 : endIdx / (yearList.length - 1);
    const ratio = (e.clientX - railRef.current.getBoundingClientRect().left) /
      railRef.current.getBoundingClientRect().width;
    const distStart = Math.abs(ratio - startPct);
    const distEnd = Math.abs(ratio - endPct);
    const which = distStart <= distEnd ? "start" : "end";
    dragHandle.current = which;
    setIsDragging(true);
    if (which === "start") {
      setLiveStart(idx);
      setLiveEnd(endIdx);
    } else {
      setLiveStart(startIdx);
      setLiveEnd(idx);
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function resetRange() {
    commitRange(0, yearList.length - 1);
  }

  if (!years.length) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>{emptyMessage}</p>
    );
  }

  const rangeYears = expandYearRange(yearList, {
    start: yearList[lo],
    end: yearList[hi],
  });
  const rangeCount = rangeYears.reduce((s, y) => s + (countByYear[y] || 0), 0);

  const displayLabel = fullRange
    ? "كل السنوات"
    : yearList[lo] === yearList[hi]
      ? yearList[lo]
      : `${yearList[lo]} — ${yearList[hi]}`;

  const displayMeta = fullRange
    ? "حرّك الدائرتين الخضراوين لتحديد فترة"
    : rangeCount > 0
      ? `${rangeCount} سؤال · ${rangeYears.length} ${rangeYears.length === 1 ? "سنة" : "سنوات"}`
      : `${rangeYears.length} ${rangeYears.length === 1 ? "سنة" : "سنوات"}`;

  return (
    <div className="year-timeline">
      <div className="year-timeline-display" aria-live="polite">
        <span className="year-timeline-value">{displayLabel}</span>
        <span className="year-timeline-meta">{displayMeta}</span>
        {!fullRange && (
          <button type="button" className="year-timeline-reset" onClick={resetRange}>
            كل السنوات
          </button>
        )}
      </div>

      <div className="year-timeline-rail" ref={railRef} onPointerDown={onRailPointerDown}>
        <span className="year-timeline-cap year-timeline-cap--start" aria-hidden />
        <span className="year-timeline-line" aria-hidden />
        <span
          className="year-timeline-range"
          style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
          aria-hidden
        />
        <span className="year-timeline-cap year-timeline-cap--end" aria-hidden />

        {yearList.map((y, i) => {
          if (yearList.length <= 1) return null;
          const pct = (i / (yearList.length - 1)) * 100;
          const inRange = i >= lo && i <= hi;
          return (
            <span
              key={y}
              className={`year-timeline-tick ${inRange ? "in-range" : ""}`}
              style={{ left: `${pct}%` }}
              aria-hidden
            />
          );
        })}

        <button
          type="button"
          className={`year-timeline-thumb year-timeline-thumb--green ${isDragging && dragHandle.current === "start" ? "dragging" : ""}`}
          style={{ left: `${yearList.length <= 1 ? 0 : (displayStart / (yearList.length - 1)) * 100}%` }}
          aria-label={`بداية الفترة: ${yearList[lo]}`}
          onPointerDown={(e) => onThumbDown("start", e)}
        />
        <button
          type="button"
          className={`year-timeline-thumb year-timeline-thumb--green ${isDragging && dragHandle.current === "end" ? "dragging" : ""}`}
          style={{ left: `${yearList.length <= 1 ? 100 : (displayEnd / (yearList.length - 1)) * 100}%` }}
          aria-label={`نهاية الفترة: ${yearList[hi]}`}
          onPointerDown={(e) => onThumbDown("end", e)}
        />
      </div>

      <div className="year-timeline-ends">
        <span>{yearList[yearList.length - 1]}</span>
        <span className="year-timeline-hint">الجزء الأخضر بين الدائرتين = الفترة المختارة</span>
        <span>{yearList[0]}</span>
      </div>
    </div>
  );
}
