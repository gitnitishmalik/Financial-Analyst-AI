import axios from "axios";

const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  timeout: 120000,
});

export const uploadDocuments = (files: File[], userId = "demo-user") => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("user_id", userId);
  return API.post("/documents/upload", form);
};

export const listDocuments = () => API.get("/documents");
export const deleteDocument = (id: string) => API.delete(`/documents/${id}`);

export const runAnalysis = (documentIds: string[], query: string) =>
  API.post("/analyze", { document_ids: documentIds, query });

export const listAnalyses = () => API.get("/analyses");

export const getQuote = (ticker: string) => API.get(`/market/quote/${ticker}`);
export const getHistory = (ticker: string, period = "1mo") =>
  API.get(`/market/history/${ticker}`, { params: { period } });
export const searchTicker = (q: string) => API.get("/market/search", { params: { q } });
export const getNews = (ticker: string) => API.get(`/market/news/${ticker}`);

export const createAlert = (ticker: string, condition: string, threshold: number) =>
  API.post("/alerts", { ticker, condition, threshold });
export const listAlerts = () => API.get("/alerts");
export const deleteAlert = (id: string) => API.delete(`/alerts/${id}`);

export const streamChat = (
  message: string,
  documentIds: string[],
  sessionId: string,
  onChunk: (text: string) => void,
  onDone: () => void
) => {
  const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/chat`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, document_ids: documentIds, session_id: sessionId }),
  }).then(async (res) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") { onDone(); return; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) onChunk(parsed.text);
          } catch {}
        }
      }
    }
    onDone();
  }).catch(() => onDone());
};

export default API;
