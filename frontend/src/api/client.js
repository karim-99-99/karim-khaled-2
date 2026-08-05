import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8010/api";

// Render free tier cold-starts can take 30–60s; keep timeout high but warm the API early.
const client = axios.create({ baseURL, timeout: 60000 });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      localStorage.getItem("refresh")
    ) {
      original._retry = true;
      try {
        const { data } = await axios.post(`${baseURL}/auth/refresh/`, {
          refresh: localStorage.getItem("refresh"),
        });
        localStorage.setItem("access", data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return client(original);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

/** Fire-and-forget ping so Render/Neon wake before the user needs data. */
export function warmApi() {
  const url = `${String(baseURL).replace(/\/$/, "")}/health/`;
  axios.get(url, { timeout: 55000 }).catch(() => {});
}

/** Keep the free-tier API awake while the tab is open. */
export function startApiKeepAlive(intervalMs = 4 * 60 * 1000) {
  warmApi();
  const id = window.setInterval(() => warmApi(), intervalMs);
  return () => window.clearInterval(id);
}

export default client;
