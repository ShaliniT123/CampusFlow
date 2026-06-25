import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in again.");

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      ...(options.headers || {})
    },
    ...options
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export const api = {
  getStudent: () => request("/student"),
  saveStudent: (student) => request("/student", { method: "POST", body: JSON.stringify(student) }),
  getTasks: () => request("/tasks"),
  createTask: (task) => request("/tasks", { method: "POST", body: JSON.stringify(task) }),
  updateTask: (id, task) => request(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(task) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: "DELETE" }),
  summarizeNotice: (text) => request("/ai/summarize", { method: "POST", body: JSON.stringify({ text }) }),
  broadcastNotice: (payload) => request("/notices/broadcast", { method: "POST", body: JSON.stringify(payload) }),
  checkAttendance: (payload) => request("/attendance/check", { method: "POST", body: JSON.stringify(payload) }),
  getAutomations: () => request("/automations")
};
