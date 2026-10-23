import client from "../api/client";

/** Ask the server for a personal BigBlueButton (or fallback) join URL and open it. */
export async function joinLiveSession(sessionId) {
  const { data } = await client.post(`/sessions/${sessionId}/join/`);
  if (data?.url) {
    window.open(data.url, "_blank", "noopener,noreferrer");
  }
  return data;
}
