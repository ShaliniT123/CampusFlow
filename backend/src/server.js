import "dotenv/config";
import cors from "cors";
import express from "express";
import { summarizeNotice } from "./ai.js";
import { triggerWebhook } from "./automation.js";
import { requireAuth } from "./auth.js";
import { supabase } from "./supabase.js";

const app = express();
const port = Number(process.env.PORT || 5000);

const allowedOrigins = String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
  .split(",").map((value) => value.trim()).filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS blocked this origin."));
  }
}));
app.use(express.json({ limit: "2mb" }));

function requireFields(body, fields) {
  const missing = fields.filter((field) => {
    const value = body[field];
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
}

function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.user_id, name: row.name, branch: row.branch, year: row.year,
    subjects: row.subjects || [], phone: row.phone, email: row.email,
    updatedAt: row.updated_at
  };
}

function mapTask(row) {
  return {
    id: row.id, title: row.title, subject: row.subject, deadline: row.deadline,
    reminderTime: row.reminder_time || "", addToCalendar: row.add_to_calendar,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "CampusFlow", mode: "multi-user", time: new Date().toISOString() });
});

app.use("/api", requireAuth);

app.get("/api/student", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("profiles").select("*")
      .eq("user_id", req.user.id).maybeSingle();
    if (error) throw error;
    res.json(mapProfile(data));
  } catch (error) { next(error); }
});

app.post("/api/student", async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "branch", "year", "subjects", "phone"]);
    const profile = {
      user_id: req.user.id,
      name: req.body.name.trim(),
      branch: req.body.branch.trim(),
      year: Number(req.body.year),
      subjects: Array.isArray(req.body.subjects) ? req.body.subjects :
        String(req.body.subjects).split(",").map((value) => value.trim()).filter(Boolean),
      phone: req.body.phone.trim(),
      email: req.user.email || req.body.email || "",
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from("profiles")
      .upsert(profile, { onConflict: "user_id" }).select().single();
    if (error) throw error;
    res.status(201).json(mapProfile(data));
  } catch (error) { next(error); }
});

app.get("/api/tasks", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("tasks").select("*")
      .eq("user_id", req.user.id).order("deadline", { ascending: true });
    if (error) throw error;
    res.json((data || []).map(mapTask));
  } catch (error) { next(error); }
});

app.post("/api/tasks", async (req, res, next) => {
  try {
    requireFields(req.body, ["title", "subject", "deadline"]);
    const { data: taskData, error: taskError } = await supabase.from("tasks").insert({
      user_id: req.user.id,
      title: req.body.title.trim(),
      subject: req.body.subject.trim(),
      deadline: req.body.deadline,
      reminder_time: req.body.reminderTime || null,
      add_to_calendar: Boolean(req.body.addToCalendar),
      status: req.body.status || "pending"
    }).select().single();
    if (taskError) throw taskError;

    const { data: profile } = await supabase.from("profiles").select("*")
      .eq("user_id", req.user.id).maybeSingle();
    const task = mapTask(taskData);

    const automation = await triggerWebhook({
      userId: req.user.id, type: "deadline",
      url: process.env.N8N_DEADLINE_WEBHOOK_URL,
      payload: {
        userId: req.user.id, taskId: task.id,
        studentName: profile?.name || "Student",
        phone: profile?.phone || "", email: req.user.email || "",
        taskTitle: task.title, subject: task.subject, deadline: task.deadline,
        reminderTime: task.reminderTime, addToCalendar: task.addToCalendar
      }
    });

    res.status(201).json({ task, automation });
  } catch (error) { next(error); }
});

app.put("/api/tasks/:id", async (req, res, next) => {
  try {
    const update = {
      ...(req.body.title !== undefined && { title: req.body.title }),
      ...(req.body.subject !== undefined && { subject: req.body.subject }),
      ...(req.body.deadline !== undefined && { deadline: req.body.deadline }),
      ...(req.body.reminderTime !== undefined && { reminder_time: req.body.reminderTime || null }),
      ...(req.body.addToCalendar !== undefined && { add_to_calendar: Boolean(req.body.addToCalendar) }),
      ...(req.body.status !== undefined && { status: req.body.status }),
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from("tasks").update(update)
      .eq("id", req.params.id).eq("user_id", req.user.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Task not found." });
    res.json(mapTask(data));
  } catch (error) { next(error); }
});

app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("tasks").delete()
      .eq("id", req.params.id).eq("user_id", req.user.id).select("id");
    if (error) throw error;
    if (!data?.length) return res.status(404).json({ error: "Task not found." });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.post("/api/ai/summarize", async (req, res, next) => {
  try {
    requireFields(req.body, ["text"]);
    res.json(await summarizeNotice(req.body.text));
  } catch (error) { next(error); }
});

app.post("/api/notices/broadcast", async (req, res, next) => {
  try {
    requireFields(req.body, ["noticeText", "eventTitle", "eventDate"]);
    const { data: profile } = await supabase.from("profiles").select("*")
      .eq("user_id", req.user.id).maybeSingle();
    const aiSummary = Array.isArray(req.body.aiSummary)
      ? req.body.aiSummary : (await summarizeNotice(req.body.noticeText)).bullets;
    const phoneList = Array.isArray(req.body.phoneList) ? req.body.phoneList :
      String(req.body.phoneList || profile?.phone || "").split(",")
        .map((phone) => phone.trim()).filter(Boolean);

    const automation = await triggerWebhook({
      userId: req.user.id, type: "notice", url: process.env.N8N_NOTICE_WEBHOOK_URL,
      payload: {
        userId: req.user.id, eventTitle: req.body.eventTitle,
        eventDate: req.body.eventDate, noticeText: req.body.noticeText,
        aiSummary, phoneList, email: req.user.email || ""
      }
    });
    res.json({ aiSummary, automation });
  } catch (error) { next(error); }
});

app.post("/api/attendance/check", async (req, res, next) => {
  try {
    requireFields(req.body, ["subject", "attended", "total", "requiredPercentage"]);
    const attended = Number(req.body.attended);
    const total = Number(req.body.total);
    const requiredPercentage = Number(req.body.requiredPercentage);

    if (!Number.isFinite(attended) || !Number.isFinite(total) || total <= 0)
      return res.status(400).json({ error: "Attendance values must be valid numbers." });
    if (attended < 0 || attended > total)
      return res.status(400).json({ error: "Attended classes must be between 0 and total classes." });
    if (requiredPercentage <= 0 || requiredPercentage >= 100)
      return res.status(400).json({ error: "Required percentage must be between 0 and 100." });

    const currentPercentage = Number(((attended / total) * 100).toFixed(2));
    let classesNeeded = 0;
    if (currentPercentage < requiredPercentage) {
      classesNeeded = Math.ceil(
        ((requiredPercentage / 100) * total - attended) /
        (1 - requiredPercentage / 100)
      );
    }

    const result = {
      subject: req.body.subject, attended, total, requiredPercentage,
      currentPercentage, atRisk: currentPercentage < requiredPercentage,
      classesNeeded,
      message: currentPercentage < requiredPercentage
        ? `You need to attend the next ${classesNeeded} ${req.body.subject} classes to reach ${requiredPercentage}%.`
        : `Your ${req.body.subject} attendance is currently safe at ${currentPercentage}%.`
    };

    const { data: profile } = await supabase.from("profiles").select("*")
      .eq("user_id", req.user.id).maybeSingle();

    const automation = await triggerWebhook({
      userId: req.user.id, type: "attendance",
      url: process.env.N8N_ATTENDANCE_WEBHOOK_URL,
      payload: {
        ...result, userId: req.user.id,
        studentName: profile?.name || "Student", phone: profile?.phone || ""
      }
    });

    res.json({ ...result, automation });
  } catch (error) { next(error); }
});

app.get("/api/automations", async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("automations").select("*")
      .eq("user_id", req.user.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    res.json((data || []).map((row) => ({
      id: row.id, type: row.type, status: row.status,
      responseMessage: row.response_message, payload: row.payload,
      createdAt: row.created_at
    })));
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || "Internal server error." });
});

app.listen(port, () => {
  console.log(`CampusFlow multi-user backend running on port ${port}`);
});
