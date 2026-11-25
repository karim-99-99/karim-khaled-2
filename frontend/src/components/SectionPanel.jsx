import { useEffect, useState } from "react";
import client from "../api/client";
import VideoPlayer from "./VideoPlayer";
import { useAuth } from "../auth/AuthContext";
import { canEditSubject } from "../auth/teacherScope";

/**
 * Inline panel under a lesson video subsection: video / PDF.
 * Homework titles live under the lesson itself (HomeworkPanel — Task 16).
 */
export default function SectionPanel({ sectionId, onUpdated }) {
  const { user } = useAuth();
  const [section, setSection] = useState(null);
  const [tab, setTab] = useState("video"); // video | pdf
  const [editVideo, setEditVideo] = useState("");
  const [editPdf, setEditPdf] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const canEdit = canEditSubject(user, section?.subject);

  function loadSection() {
    return client.get(`/lesson-sections/${sectionId}/`).then((res) => {
      setSection(res.data);
      setEditVideo(res.data.bunny_video_id || "");
      setEditPdf(res.data.pdf_url || "");
      return res.data;
    });
  }

  useEffect(() => {
    setTab("video");
    setMsg("");
    setSection(null);
    loadSection().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  async function saveSectionPatch(patch, okMsg) {
    setBusy(true);
    setMsg("");
    try {
      const { data } = await client.patch(`/lesson-sections/${sectionId}/`, patch);
      setSection(data);
      setMsg(okMsg || "تم الحفظ ✓");
      onUpdated?.(data);
    } catch (e) {
      setMsg(e.response?.data?.detail || "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  if (!section) return <div className="spinner">جاري التحميل…</div>;

  return (
    <div className="section-panel">
      <div className="filter-row" style={{ marginBottom: 14 }}>
        {[
          ["video", canEdit ? "إضافة / فيديو" : "فيديو"],
          ["pdf", canEdit ? "إضافة PDF" : "PDF"],
        ].map(([id, label]) => (
          <span
            key={id}
            className={`chip ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </span>
        ))}
      </div>

      {msg && (
        <div className="banner" style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}

      {tab === "video" && (
        <div>
          {section.bunny_video_id ? (
            <VideoPlayer bunnyId={section.bunny_video_id} />
          ) : (
            <p style={{ color: "var(--text-muted)", marginBottom: canEdit ? 12 : 0 }}>
              لا يوجد فيديو لهذه الحصة بعد.
            </p>
          )}
          {canEdit && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
                فيديو الحصة — Bunny أو رابط (YouTube / Drive / أي رابط)
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="form-control"
                  style={{ flex: 1, minWidth: 180 }}
                  value={editVideo}
                  onChange={(e) => setEditVideo(e.target.value)}
                  placeholder="Bunny GUID أو https://youtube.com/... أو Drive"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() =>
                    saveSectionPatch({ bunny_video_id: editVideo.trim() }, "تم حفظ الفيديو ✓")
                  }
                >
                  حفظ الفيديو
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "pdf" && (
        <div>
          {section.pdf_url ? (
            <a
              className="btn btn-secondary"
              href={section.pdf_url}
              target="_blank"
              rel="noreferrer"
              style={{ marginBottom: canEdit ? 12 : 0 }}
            >
              فتح PDF
            </a>
          ) : (
            <p style={{ color: "var(--text-muted)", marginBottom: canEdit ? 12 : 0 }}>
              لا يوجد PDF لهذه الحصة بعد.
            </p>
          )}
          {canEdit && (
            <div>
              <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>رابط PDF</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="form-control"
                  style={{ flex: 1, minWidth: 180 }}
                  value={editPdf}
                  onChange={(e) => setEditPdf(e.target.value)}
                  placeholder="https://…"
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => saveSectionPatch({ pdf_url: editPdf.trim() }, "تم حفظ PDF ✓")}
                >
                  حفظ PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
