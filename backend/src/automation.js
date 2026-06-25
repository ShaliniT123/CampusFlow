import { v4 as uuidv4 } from "uuid";
import { updateDb } from "./db.js";

export async function triggerWebhook({ type, url, payload }) {
  const startedAt = new Date().toISOString();
  let status = "skipped";
  let responseMessage = "Webhook URL is not configured.";

  if (url) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const body = await response.text();
      status = response.ok ? "success" : "failed";
      responseMessage = body || `HTTP ${response.status}`;
    } catch (error) {
      status = "failed";
      responseMessage = error.message;
    }
  }

  const log = {
    id: uuidv4(),
    type,
    status,
    responseMessage,
    payload,
    createdAt: startedAt
  };

  await updateDb((db) => {
    db.automations.unshift(log);
    db.automations = db.automations.slice(0, 100);
    return db;
  });

  return log;
}
