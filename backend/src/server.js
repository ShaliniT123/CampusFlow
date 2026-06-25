import "dotenv/config";
import cors from "cors";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { readDb, updateDb } from "./db.js";
import { summarizeNotice } from "./ai.js";
import { triggerWebhook } from "./automation.js";

const app = express();
const port = Number(process.env.PORT || 5000);

const allowedOrigins = String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

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

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "CampusFlow",
    time: new Date().toISOString()
  });
});

app.get("/api/student", async (req, res, next) => {
  try {
    const db = await readDb();
    res.json(db.student);
  } catch (error) {
    next(error);
  }
});

app.post("/api/student", async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "branch", "year", "subjects", "phone", "email"]);

    const student = {
      id: req.body.id || uuidv4(),
      name: req.body.name.trim(),
      branch: req.body.branch.trim(),
      year: req.body.year,
      subjects: Array.isArray(req.body.subjects)
        ? req.body.subjects
        : String(req.body.subjects).split(",").map((value) => value.trim()).filter(Boolean),
      phone: req.body.phone.trim(),
      email: req.body.email.trim(),
      updatedAt: new Date().toISOString()
    };

    await updateDb((db) => {
      db.student = student;
      return db;
    });

    res.status(201).json(student);
  } catch (error) {
    next(error);
  }
});

app.get("/api/tasks", async (req, res, next) => {
  try {
    const db = await readDb();
    const tasks = [...db.tasks].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

app.post("/api/tasks", async (req, res, next) => {
  try {
    requireFields(req.body, ["title", "subject", "deadline"]);

    const db = await readDb();
    const task = {
      id: uuidv4(),
      title: req.body.title.trim(),
      subject: req.body.subject.trim(),
      deadline: req.body.deadline,
      reminderTime: req.body.reminderTime || "",
      addToCalendar: Boolean(req.body.addToCalendar),
      status: req.body.status || "pending",
      createdAt: new Date().toISOString()
    };

    await updateDb((current) => {
      current.tasks.unshift(task);
      return current;
    });

    const student = db.student || {};
    const automation = await triggerWebhook({
      type: "deadline",
      url: process.env.N8N_DEADLINE_WEBHOOK_URL,
      payload: {
        taskId: task.id,
        studentName: student.name || "Student",
        phone: student.phone || "",
        email: student.email || "",
        taskTitle: task.title,
        subject: task.subject,
        deadline: task.deadline,
        reminderTime: task.reminderTime,
        addToCalendar: task.addToCalendar
      }
    });

    res.status(201).json({ task, automation });
  } catch (error) {
    next(error);
  }
});

app.put("/api/tasks/:id", async (req, res, next) => {
  try {
    let updatedTask = null;

    await updateDb((db) => {
      const index = db.tasks.findIndex((task) => task.id === req.params.id);
      if (index === -1) {
        const error = new Error("Task not found.");
        error.status = 404;
        throw error;
      }

      db.tasks[index] = {
        ...db.tasks[index],
        ...req.body,
        id: db.tasks[index].id,
        updatedAt: new Date().toISOString()
      };

      updatedTask = db.tasks[index];
      return db;
    });

    res.json(updatedTask);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/tasks/:id", async (req, res, next) => {
  try {
    let deleted = false;

    await updateDb((db) => {
      const originalLength = db.tasks.length;
      db.tasks = db.tasks.filter((task) => task.id !== req.params.id);
      deleted = db.tasks.length < originalLength;
      return db;
    });

    if (!deleted) {
      return res.status(404).json({ error: "Task not found." });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post("/api/ai/summarize", async (req, res, next) => {
  try {
    requireFields(req.body, ["text"]);
    const result = await summarizeNotice(req.body.text);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/notices/broadcast", async (req, res, next) => {
  try {
    requireFields(req.body, ["noticeText", "eventTitle", "eventDate"]);

    const db = await readDb();
    const aiSummary = Array.isArray(req.body.aiSummary)
      ? req.body.aiSummary
      : (await summarizeNotice(req.body.noticeText)).bullets;

    const phoneList = Array.isArray(req.body.phoneList)
      ? req.body.phoneList
      : String(req.body.phoneList || db.student?.phone || "")
          .split(",")
          .map((phone) => phone.trim())
          .filter(Boolean);

    const automation = await triggerWebhook({
      type: "notice",
      url: process.env.N8N_NOTICE_WEBHOOK_URL,
      payload: {
        eventTitle: req.body.eventTitle,
        eventDate: req.body.eventDate,
        noticeText: req.body.noticeText,
        aiSummary,
        phoneList,
        email: db.student?.email || ""
      }
    });

    res.json({ aiSummary, automation });
  } catch (error) {
    next(error);
  }
});

app.post("/api/attendance/check", async (req, res, next) => {
  try {
    requireFields(req.body, ["subject", "attended", "total", "requiredPercentage"]);

    const attended = Number(req.body.attended);
    const total = Number(req.body.total);
    const requiredPercentage = Number(req.body.requiredPercentage);

    if (!Number.isFinite(attended) || !Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ error: "Attendance values must be valid numbers." });
    }

    if (attended < 0 || attended > total) {
      return res.status(400).json({ error: "Attended classes must be between 0 and total classes." });
    }

    if (requiredPercentage <= 0 || requiredPercentage >= 100) {
      return res.status(400).json({ error: "Required percentage must be between 0 and 100." });
    }

    const currentPercentage = Number(((attended / total) * 100).toFixed(2));
    let classesNeeded = 0;

    if (currentPercentage < requiredPercentage) {
      classesNeeded = Math.ceil(
        ((requiredPercentage / 100) * total - attended) /
        (1 - requiredPercentage / 100)
      );
    }

    const result = {
      subject: req.body.subject,
      attended,
      total,
      requiredPercentage,
      currentPercentage,
      atRisk: currentPercentage < requiredPercentage,
      classesNeeded,
      message: currentPercentage < requiredPercentage
        ? `You need to attend the next ${classesNeeded} ${req.body.subject} classes to reach ${requiredPercentage}%.`
        : `Your ${req.body.subject} attendance is currently safe at ${currentPercentage}%.`
    };

    const db = await readDb();
    const automation = await triggerWebhook({
      type: "attendance",
      url: process.env.N8N_ATTENDANCE_WEBHOOK_URL,
      payload: {
        ...result,
        studentName: db.student?.name || "Student",
        phone: db.student?.phone || ""
      }
    });

    res.json({ ...result, automation });
  } catch (error) {
    next(error);
  }
});

app.get("/api/automations", async (req, res, next) => {
  try {
    const db = await readDb();
    res.json(db.automations);
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || "Internal server error."
  });
});

app.listen(port, () => {
  console.log(`CampusFlow backend running on http://localhost:${port}`);
});
