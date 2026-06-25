import { supabase } from "./supabase.js";

export async function triggerWebhook({ userId, type, url, payload }) {
  const startedAt = new Date().toISOString();
  let status = "skipped";
  let responseMessage = "Webhook URL is not configured.";

  if (url) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  const { data, error } = await supabase
    .from("automations")
    .insert({
      user_id: userId,
      type,
      status,
      response_message: responseMessage,
      payload,
      created_at: startedAt
    })
    .select()
    .single();

  if (error) {
    console.error("Could not store automation log:", error.message);
    return { id: null, type, status, responseMessage, payload, createdAt: startedAt };
  }

  return {
    id: data.id,
    type: data.type,
    status: data.status,
    responseMessage: data.response_message,
    payload: data.payload,
    createdAt: data.created_at
  };
}
