import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject, teachableSubjectIds } from "../auth/teacherScope";
import { lockSubjectTheme } from "../theme/subjects";
import useSubjectSkin from "../theme/useSubjectSkin";
import "../styles/teacher-tasks.css";

function pillClass(tone) {
  if (tone === "g") return "p-g";
  if (tone === "o") return "p-o";
  if (tone === "r") return "p-r";
  if (tone === "b") return "p-b";
  return "p-gr";
}

function nodeKey(mainId, subId) {
  return subId ? `s:${subId}` : `m:${mainId}`;
}

export default function TeacherTasks() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subjects, setSubjects] = useState([]);
  const subjectId = Number(searchParams.get("subject") || 0) || null;
  const groupId = searchParams.get("group") ? Number(searchParams.get("group")) : null;

  const [board, setBoard] = useState(null);
  const [tree, setTree] = useState([]);
  const [openKey, setOpenKey] = useState(null); // lesson:ID | extra:ID
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedMains, setExpandedMains] = useState({});
  const [selected, setSelected] = useState({}); // nodeKey -> {collection_lesson, collection_sub_lesson?}
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const canEdit = board?.can_edit ?? canEditSubject(user, subjectId);
  const { subjectName, skin, key: subjectKey } = useSubjectSkin(subjectId);

  useEffect(() => {
    client.get("/subjects/").then((res) => {
      const all = res.data.results || res.data || [];
      const ids = teachableSubjectIds(user);
      const filtered =
        user?.role === "admin" || ids == null
          ? all
          : all.filter((s) => ids.map(String).includes(String(s.id)));
      setSubjects(filtered);
      if (!subjectId && filtered.length) {
        setSearchParams({ subject: String(filtered[0].id) }, { replace: true });
      }
    });
  }, [user]);

  useEffect(() => {
    if (subjectKey) lockSubjectTheme(subjectKey);
  }, [subjectKey]);

  function loadBoard() {
    if (!subjectId) return Promise.resolve();
    setLoading(true);
    const q = new URLSearchParams({ subject: String(subjectId) });
    if (groupId) q.set("group", String(groupId));
    return client
      .get(`/teacher/tasks-board/?${q}`)
      .then((res) => setBoard(res.data))
      .catch((e) => {
        setBoard(null);
        setMsg(e.response?.data?.detail || "تعذّر تحميل المهام");
      })
      .finally(() => setLoading(false));
  }

  function loadTree() {
    if (!subjectId) return;
    client
      .get(`/teacher/tasks-board/tree/?subject=${subjectId}`)
      .then((res) => setTree(res.data.tree || []))
      .catch(() => setTree([]));
  }

  useEffect(() => {
    loadBoard();
    loadTree();
    setOpenKey(null);
    setShowAdd(false);
    setSelected({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, groupId]);

  const openRow = useMemo(() => {
    if (!board || !openKey) return null;
    const [kind, id] = openKey.split(":");
    const list = kind === "extra" ? board.extras : board.lessons;
    return (list || []).find((r) => String(r.id) === String(id)) || null;
  }, [board, openKey]);

  const linkedKeys = useMemo(() => {
    const set = new Set();
    (openRow?.collections || []).forEach((c) => {
      set.add(nodeKey(c.collection_lesson_id, c.collection_sub_lesson_id));
    });
    return set;
  }, [openRow]);

  function setScopeGroup(gid) {
    const next = { subject: String(subjectId) };
    if (gid) next.group = String(gid);
    setSearchParams(next);
  }

  function toggleOpen(row) {
    const key = `${row.kind}:${row.id}`;
    if (openKey === key) {
      setOpenKey(null);
      setShowAdd(false);
      setSelected({});
      return;
    }
    setOpenKey(key);
    setShowAdd(false);
    setSelected({});
  }

  function mainState(main) {
    const subIds = (main.subs || []).map((s) => s.id);
    const linkedSubs = subIds.filter((id) => linkedKeys.has(nodeKey(main.id, id)));
    const wholeLinked = linkedKeys.has(nodeKey(main.id, null));
    const selSubs = subIds.filter((id) => selected[nodeKey(main.id, id)]);
    const wholeSel = !!selected[nodeKey(main.id, null)];

    if (wholeLinked) return { linked: "all", sel: "none" };
    if (linkedSubs.length === subIds.length && subIds.length) return { linked: "all", sel: "none" };
    if (linkedSubs.length) return { linked: "partial", sel: wholeSel ? "all" : selSubs.length ? "partial" : "none" };

    if (wholeSel) return { linked: "none", sel: "all" };
    if (selSubs.length === subIds.length && subIds.length) return { linked: "none", sel: "all" };
    if (selSubs.length) return { linked: "none", sel: "partial" };
    return { linked: "none", sel: "none" };
  }

  function toggleMain(main) {
    if (linkedKeys.has(nodeKey(main.id, null))) return;
    const allSubsLinked =
      main.subs?.length &&
      main.subs.every((s) => linkedKeys.has(nodeKey(main.id, s.id)));
    if (allSubsLinked) return;

    const key = nodeKey(main.id, null);
    const st = mainState(main);
    setSelected((prev) => {
      const next = { ...prev };
      if (st.sel === "all") {
        delete next[key];
        (main.subs || []).forEach((s) => delete next[nodeKey(main.id, s.id)]);
      } else {
        // select whole main; clear individual subs
        (main.subs || []).forEach((s) => delete next[nodeKey(main.id, s.id)]);
        next[key] = { collection_lesson: main.id, collection_sub_lesson: null };
      }
      return next;
    });
  }

  function toggleSub(main, sub) {
    if (linkedKeys.has(nodeKey(main.id, null))) return;
    if (linkedKeys.has(nodeKey(main.id, sub.id))) return;
    const key = nodeKey(main.id, sub.id);
    setSelected((prev) => {
      const next = { ...prev };
      delete next[nodeKey(main.id, null)];
      if (next[key]) delete next[key];
      else next[key] = { collection_lesson: main.id, collection_sub_lesson: sub.id };
      return next;
    });
  }

  const selectedList = Object.values(selected);
  const selectedQ = selectedList.reduce((n, node) => {
    const main = tree.find((t) => t.id === node.collection_lesson);
    if (!main) return n;
    if (!node.collection_sub_lesson) return n + (main.question_count || 0);
    const sub = (main.subs || []).find((s) => s.id === node.collection_sub_lesson);
    return n + (sub?.question_count || 0);
  }, 0);

  async function addSelected() {
    if (!openRow || !selectedList.length) return;
    setBusy(true);
    setMsg("");
    try {
      const body = {
        action: "add",
        nodes: selectedList,
        group: groupId || null,
      };
      if (openRow.kind === "extra") body.extra_session = openRow.id;
      else body.lesson = openRow.id;
      const { data } = await client.post("/teacher/tasks-board/links/", body);
      if (data.errors?.length) setMsg(data.errors.join(" · "));
      else setMsg(`تمت إضافة ${data.created?.length || 0} تجميعة ✓`);
      setSelected({});
      setShowAdd(false);
      await loadBoard();
    } catch (e) {
      setMsg(e.response?.data?.detail || e.response?.data?.errors?.join?.(" · ") || "تعذّرت الإضافة");
    } finally {
      setBusy(false);
    }
  }

  async function removeLink(linkId) {
    if (!canEdit) return;
    setBusy(true);
    setMsg("");
    try {
      await client.delete(`/teacher/tasks-board/links/?id=${linkId}`);
      await loadBoard();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  }

  async function moveLink(linkId, dir) {
    if (!canEdit || !openRow) return;
    const cols = [...(openRow.collections || [])];
    const i = cols.findIndex((c) => c.id === linkId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cols.length) return;
    const next = [...cols];
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    setBusy(true);
    try {
      const body = {
        action: "reorder",
        ordered_ids: next.map((c) => c.id),
        group: groupId || null,
      };
      if (openRow.kind === "extra") body.extra_session = openRow.id;
      else body.lesson = openRow.id;
      await client.post("/teacher/tasks-board/links/", body);
      await loadBoard();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الترتيب");
    } finally {
      setBusy(false);
    }
  }

  async function resetDefault(lessonId) {
    if (!canEdit || !groupId) return;
    setBusy(true);
    try {
      await client.post("/teacher/tasks-board/links/", {
        action: "reset_default",
        lesson: lessonId,
        group: groupId,
      });
      setMsg("تم الرجوع للافتراضي ✓");
      await loadBoard();
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الإلغاء");
    } finally {
      setBusy(false);
    }
  }

  const filteredTree = tree.filter((m) => {
    if (!search.trim()) return true;
    const q = search.trim();
    if (m.title.includes(q)) return true;
    return (m.subs || []).some((s) => s.title.includes(q));
  });

  const roleLabel =
    user?.role === "admin"
      ? "المدير"
      : canEdit
        ? "المدرس الأساسي"
        : "المدرس الثانوي";

  if (!subjectId) {
    return <div className="spinner">جاري التحميل…</div>;
  }

  const stats = board?.stats || {};
  const lessons = board?.lessons || [];
  const extras = board?.extras || [];

  return (
    <div className="ttasks" style={skin}>
      <div className="crumb">
        المهام › <b>ربط الدروس بالمهام</b>
        {subjects.length > 1 && (
          <select
            className="form-control"
            style={{ display: "inline-block", width: "auto", marginRight: 12 }}
            value={subjectId}
            onChange={(e) => setSearchParams({ subject: e.target.value })}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="hero">
        <div>
          <div style={{ opacity: 0.9, fontWeight: 700 }}>
            مدرس {subjectName || "…"} · {roleLabel}
          </div>
          <h1>ربط الدروس بالتجميعات</h1>
          <p>المهام تظهر للطالب تلقائياً بعد انتهاء حصة الدرس في مجموعته</p>
        </div>
        <div className="stats">
          <div className="st">
            <b>
              {stats.linked_lessons ?? 0}/{stats.total_lessons ?? 0}
            </b>
            <small>درس مربوط</small>
          </div>
          <div className="st">
            <b>{stats.linked_tasks ?? 0}</b>
            <small>مهمة مربوطة</small>
          </div>
          <div className="st">
            <b>{stats.group_overrides ?? 0}</b>
            <small>تخصيص لمجموعات</small>
          </div>
        </div>
      </div>

      <div className="bar">
        <div className="chips">
          <span className="lbl">عرض المهام لـ</span>
          <span
            className={`chip ${!groupId ? "on" : ""}`}
            onClick={() => setScopeGroup(null)}
            role="button"
            tabIndex={0}
          >
            الافتراضي · كل المجموعات
          </span>
          {(board?.groups || []).map((g) => (
            <span
              key={g.id}
              className={`chip ${groupId === g.id ? "on" : ""}`}
              onClick={() => setScopeGroup(g.id)}
              role="button"
              tabIndex={0}
            >
              {g.has_override ? <span className="dot" /> : null}
              {g.name}
            </span>
          ))}
        </div>
        <div className="hint">● = مجموعة فيها تخصيص مختلف عن الافتراضي</div>
      </div>

      {msg && (
        <div className="banner" style={{ marginTop: 12 }}>
          {msg}
        </div>
      )}

      {loading && <div className="spinner">جاري التحميل…</div>}

      <div className="grid">
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2>دروس التأسيس ({lessons.length})</h2>
              <div className="sub">
                الواجبات بتتربط تلقائي من عناوين الدرس · اختار التجميعات ورتّبها · التعديل على
                &quot;الافتراضي&quot; يطبَّق على كل المجموعات اللي مش متخصصة
              </div>
            </div>
            <div className="counts">
              <span className="cnt">📘 واجبات</span>
              <span className="cnt">📚 تجميعات</span>
            </div>
          </div>

          {extras.map((row) => {
            const key = `extra:${row.id}`;
            const open = openKey === key;
            return (
              <div key={key} className={`lesson extra${open ? " open" : ""}`}>
                <div className="lh">
                  <div className="num">+</div>
                  <div className="lt">
                    <b>{row.title}</b>
                    <span className={`pill ${pillClass(row.release?.tone)}`}>{row.release?.label}</span>
                    <div className="meta">
                      {row.session_label || ""}
                      {row.collection_count
                        ? ` · ${row.collection_count} تجميعة`
                        : " · مفيش مهام"}
                    </div>
                  </div>
                  {canEdit && (
                    <button type="button" className={`btn${open ? "" : " ghost"}`} onClick={() => toggleOpen(row)}>
                      {open ? "إغلاق" : row.collection_count ? "تعديل" : "+ ربط مهام"}
                    </button>
                  )}
                  {!canEdit && (
                    <button type="button" className="btn ghost" onClick={() => toggleOpen(row)}>
                      {open ? "إغلاق" : "عرض"}
                    </button>
                  )}
                </div>
                {open && renderExpanded(row)}
              </div>
            );
          })}

          {lessons.map((row) => {
            const key = `lesson:${row.id}`;
            const open = openKey === key;
            const qTotal =
              (row.homework_question_total || 0) + (row.collection_question_total || 0);
            return (
              <div key={key} className={`lesson${open ? " open" : ""}`}>
                <div className="lh">
                  <div className="num">{row.order_number}</div>
                  <div className="lt">
                    <b>{row.title}</b>
                    <span className={`pill ${pillClass(row.release?.tone)}`}>{row.release?.label}</span>
                    {row.is_override && groupId ? (
                      <span className="pill p-b">مخصص لهذه المجموعة</span>
                    ) : null}
                    {!groupId && row.override_group_names?.length
                      ? row.override_group_names.map((n) => (
                          <span key={n} className="pill p-b">
                            تخصيص {n}
                          </span>
                        ))
                      : null}
                    <div className="meta">
                      {row.homework_count || row.collection_count
                        ? `${row.homework_count} واجب · ${row.collection_count} تجميعة · ${qTotal} سؤال`
                        : "الطلاب مش هيشوفوا مهام يوم الحصة دي"}
                    </div>
                  </div>
                  <div className="counts">
                    <span className="cnt">📘 {row.homework_count}</span>
                    <span className="cnt">📚 {row.collection_count}</span>
                  </div>
                  {canEdit && groupId && row.is_override && (
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => resetDefault(row.id)}>
                      ↺ رجوع للافتراضي
                    </button>
                  )}
                  <button
                    type="button"
                    className={`btn${open || !(row.homework_count || row.collection_count) ? "" : " ghost"}`}
                    onClick={() => toggleOpen(row)}
                  >
                    {open
                      ? "إغلاق"
                      : canEdit
                        ? row.homework_count || row.collection_count
                          ? "تعديل"
                          : "+ ربط مهام"
                        : "عرض"}
                  </button>
                </div>
                {open && renderExpanded(row)}
              </div>
            );
          })}

          <div className="legend">
            <span>{lessons.length} درس تأسيس</span>
            <span>·</span>
            <span>الحصص الإضافية تظهر عند اختيار مجموعة معينة</span>
            <Link to="/courses" style={{ marginRight: "auto" }}>
              إدارة المادة ←
            </Link>
          </div>
        </div>

        <div className="card side">
          {showAdd && openRow && canEdit ? (
            <>
              <h2>إضافة إلى: {openRow.title}</h2>
              <div className="sub">
                {groupId
                  ? (board?.groups || []).find((g) => g.id === groupId)?.name || "مجموعة"
                  : "الافتراضي · كل المجموعات"}
              </div>
              <div className="sub" style={{ margin: "10px 0" }}>
                📚 اختار تجميعة رئيسية كاملة أو عناوين فرعية منها
              </div>
              <input
                className="search"
                placeholder="🔍 ابحث في تجميعات المادة…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {filteredTree.map((main) => {
                const st = mainState(main);
                const open = expandedMains[main.id] !== false;
                return (
                  <div key={main.id}>
                    <button
                      type="button"
                      className={`item${st.sel !== "none" ? " sel" : ""}`}
                      style={{ background: "#fafbfd" }}
                      onClick={() => toggleMain(main)}
                    >
                      <span
                        className={`ck${st.sel === "partial" || st.linked === "partial" ? " partial" : ""}`}
                      />
                      <div className="it">
                        {main.title}
                        <small>
                          تجميعة رئيسية · {main.sub_count} عنوان · {main.question_count} سؤال
                          {st.linked === "all" ? (
                            <>
                              {" "}
                              · <span className="used">✓ مربوطة بالدرس</span>
                            </>
                          ) : null}
                        </small>
                      </div>
                      <span
                        style={{ color: "var(--mut)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMains((p) => ({ ...p, [main.id]: !open }));
                        }}
                      >
                        {open ? "⌃" : "⌄"}
                      </span>
                    </button>
                    {open && (
                      <div className="subs">
                        {(main.subs || []).map((sub) => {
                          const linked = linkedKeys.has(nodeKey(main.id, sub.id)) || linkedKeys.has(nodeKey(main.id, null));
                          const sel = !!selected[nodeKey(main.id, sub.id)] || !!selected[nodeKey(main.id, null)];
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              className={`item${sel && !linkedKeys.has(nodeKey(main.id, null)) ? " sel" : ""}`}
                              disabled={linked}
                              onClick={() => toggleSub(main, sub)}
                            >
                              <span className="ck" />
                              <div className="it">
                                {sub.title}
                                <small>
                                  {sub.question_count} سؤال
                                  {linked ? (
                                    <>
                                      {" "}
                                      · <span className="used">✓ مربوطة بالدرس</span>
                                    </>
                                  ) : null}
                                </small>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="foot">
                <span className="sub">
                  {selectedList.length} محدد · {selectedQ} سؤال
                </span>
                <button type="button" className="btn" disabled={busy || !selectedList.length} onClick={addSelected}>
                  إضافة للدرس
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>لوحة الإضافة</h2>
              <div className="sub" style={{ marginTop: 8 }}>
                افتح درساً واضغط &quot;+ إضافة تجميعة&quot; لاختيار من شجرة التجميعات.
              </div>
              <div className="ovr" style={{ margin: "16px 0 0", display: "block" }}>
                <b>💡 لما تختار مجموعة من فوق</b>
                <br />
                تقدر تغيّر مهام أي درس لها بس، وتضيف مهام لحصصها الإضافية. وزرار &quot;رجوع
                للافتراضي&quot; يلغي التخصيص.
              </div>
              {!canEdit && (
                <div className="banner" style={{ marginTop: 12 }}>
                  عرض فقط — المدرس الثانوي لا يعدّل الربط.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  function renderExpanded(row) {
    return (
      <div className="lb">
        <div className="col">
          <h4>
            📘 الواجبات{" "}
            <span className="pill p-gr" style={{ margin: 0 }}>
              تلقائي · عناوين الدرس الفرعية
            </span>
          </h4>
          {(row.homework || []).map((h) => (
            <div key={h.id} className="task locked">
              <span className="drag">🔒</span>
              <div className="tt">
                {h.title}
                <small>واجب فرعي · {h.question_count} سؤال</small>
              </div>
            </div>
          ))}
          {!row.homework?.length && <div className="sub">لا عناوين واجب لهذا الدرس.</div>}
          <div className="sub" style={{ fontSize: 12.5, marginTop: 8 }}>
            تُضاف وتُعدَّل من &quot;إدارة المادة&quot; داخل الدرس نفسه
          </div>
        </div>
        <div className="col">
          <h4>📚 التجميعات</h4>
          {(row.collections || []).map((c) => (
            <div key={c.id} className="task">
              {canEdit ? (
                <span className="drag" title="ترتيب">
                  <button type="button" className="btn ghost" style={{ padding: "2px 6px" }} disabled={busy} onClick={() => moveLink(c.id, -1)}>
                    ↑
                  </button>
                  <button type="button" className="btn ghost" style={{ padding: "2px 6px" }} disabled={busy} onClick={() => moveLink(c.id, 1)}>
                    ↓
                  </button>
                </span>
              ) : (
                <span className="drag">⋮⋮</span>
              )}
              <div className="tt">
                {c.title}
                {c.is_whole_main ? <span className="pill p-b">كل الفرعيات</span> : null}
                <small>{c.meta}</small>
              </div>
              {canEdit && (
                <button type="button" className="x" disabled={busy} onClick={() => removeLink(c.id)}>
                  ✕
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <div
              className="add"
              role="button"
              tabIndex={0}
              onClick={() => {
                setShowAdd(true);
                setSelected({});
              }}
            >
              + إضافة تجميعة
            </div>
          )}
        </div>
      </div>
    );
  }
}
