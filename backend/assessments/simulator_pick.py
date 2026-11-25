"""Lesson-weighted question picking for the simulator (Task 24 / brief 9.3)."""

from __future__ import annotations

import random
from collections.abc import Iterable, Sequence


def lesson_weights(n: int) -> list[float]:
    """w_i = 1 + 2·(i−1)/(n−1); first=1, last=3. n=1 → [1]."""
    if n <= 0:
        return []
    if n == 1:
        return [1.0]
    return [1.0 + 2.0 * i / (n - 1) for i in range(n)]


def expected_counts(n_questions: int, n_lessons: int) -> list[float]:
    """e_i = N · w_i / Σw."""
    if n_questions < 1 or n_lessons < 1:
        return [0.0] * max(0, n_lessons)
    weights = lesson_weights(n_lessons)
    total_w = sum(weights) or 1.0
    return [n_questions * w / total_w for w in weights]


def allocate_lesson_counts(
    n_questions: int,
    n_lessons: int,
    rng: random.Random | None = None,
) -> list[int]:
    """
    Floor expected counts, then give remaining seats one-by-one with
    probability proportional to the fractional part (brief 9.3 step 3).
    """
    rng = rng or random
    if n_questions < 1 or n_lessons < 1:
        return [0] * max(0, n_lessons)
    expected = expected_counts(n_questions, n_lessons)
    floors = [int(e) for e in expected]
    rem = n_questions - sum(floors)
    fracs = [e - f for e, f in zip(expected, floors)]
    out = list(floors)
    for _ in range(rem):
        total_f = sum(fracs)
        if total_f <= 0:
            # Degenerate: all integer — pick uniformly among lessons.
            idx = rng.randrange(n_lessons)
        else:
            r = rng.random() * total_f
            acc = 0.0
            idx = n_lessons - 1
            for i, f in enumerate(fracs):
                acc += f
                if r <= acc:
                    idx = i
                    break
        out[idx] += 1
    return out


def redistribute_shortfalls(
    assigned: Sequence[int],
    available: Sequence[int],
) -> list[int]:
    """
    If a lesson has fewer questions than assigned, move the shortfall to the
    next later lesson, then earlier ones if needed (brief 9.3 step 4).
    """
    n = len(assigned)
    out = [min(assigned[i], available[i]) for i in range(n)]
    shortfalls = [max(0, assigned[i] - available[i]) for i in range(n)]
    for i in range(n):
        need = shortfalls[i]
        if need <= 0:
            continue
        # Later lessons first.
        for j in range(i + 1, n):
            room = available[j] - out[j]
            if room <= 0:
                continue
            take = min(need, room)
            out[j] += take
            need -= take
            if need <= 0:
                break
        # Then earlier.
        if need > 0:
            for j in range(i - 1, -1, -1):
                room = available[j] - out[j]
                if room <= 0:
                    continue
                take = min(need, room)
                out[j] += take
                need -= take
                if need <= 0:
                    break
    return out


def pick_from_pools(
    pools: Sequence[Sequence],
    counts: Sequence[int],
    rng: random.Random | None = None,
) -> list:
    """Random sample without replacement inside each lesson pool."""
    rng = rng or random
    picked = []
    for pool, k in zip(pools, counts):
        if k < 1 or not pool:
            continue
        items = list(pool)
        rng.shuffle(items)
        picked.extend(items[: min(k, len(items))])
    return picked


def interleave_subjects(
    by_subject: dict[int, list],
    rng: random.Random | None = None,
    max_run: int = 2,
) -> list:
    """
    Fully shuffle across subjects; avoid more than `max_run` consecutive
    from the same subject when possible (brief 9.3).
    """
    rng = rng or random
    queues = {
        sid: list(qs)
        for sid, qs in by_subject.items()
        if qs
    }
    for q in queues.values():
        rng.shuffle(q)
    result = []
    last_sid = None
    run = 0
    while queues:
        candidates = list(queues.keys())
        if last_sid is not None and run >= max_run and len(candidates) > 1:
            candidates = [s for s in candidates if s != last_sid] or candidates
        sid = rng.choice(candidates)
        result.append(queues[sid].pop())
        if not queues[sid]:
            del queues[sid]
        if sid == last_sid:
            run += 1
        else:
            last_sid = sid
            run = 1
    return result


def pick_weighted_for_subject(
    lesson_pools: Sequence[Sequence],
    n_questions: int,
    rng: random.Random | None = None,
) -> list:
    """
    Run 9.3 for one subject: lesson_pools ordered by course order (first→last).
    Each pool is the filtered question list for that lesson.
    """
    rng = rng or random
    n_lessons = len(lesson_pools)
    if n_questions < 1 or n_lessons < 1:
        return []
    available = [len(p) for p in lesson_pools]
    total_avail = sum(available)
    n_questions = min(n_questions, total_avail)
    if n_questions < 1:
        return []
    assigned = allocate_lesson_counts(n_questions, n_lessons, rng=rng)
    assigned = redistribute_shortfalls(assigned, available)
    # If redistribute still under-filled (all short), top up from leftovers.
    got = sum(assigned)
    if got < n_questions:
        leftover = n_questions - got
        for i in range(n_lessons - 1, -1, -1):
            room = available[i] - assigned[i]
            if room <= 0:
                continue
            take = min(leftover, room)
            assigned[i] += take
            leftover -= take
            if leftover <= 0:
                break
    return pick_from_pools(lesson_pools, assigned, rng=rng)
