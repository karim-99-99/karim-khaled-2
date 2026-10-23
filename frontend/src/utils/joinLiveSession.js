import client from "../api/client";

/** Ask the server for a personal BigBlueButton (or fallback) join URL and open it. */
export async function joinLiveSession(sessionId) {
  // Open the tab during the click, before the request. A tab opened after
  // the response loses the click, and the browser then blocks the microphone.
  const popup = window.open("about:blank", "_blank");
  try {
    const { data } = await client.post(`/sessions/${sessionId}/join/`);
    if (data?.url) {
      if (popup) popup.location.href = data.url;
      else window.location.assign(data.url);
    } else if (popup && !popup.closed) {
      popup.close();
    }
    return data;
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    throw error;
  }
}
