import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./api";
import { supabase } from "./supabase";
import "./styles.css";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "⌂" },
  { id: "tasks", label: "Tasks", icon: "✓" },
  { id: "notice", label: "Notice AI", icon: "✦" },
  { id: "attendance", label: "Attendance", icon: "％" },
  { id: "automations", label: "Automations", icon: "↯" },
  { id: "profile", label: "Profile", icon: "◎" }
];

function App() {
  const [page, setPage] = useState("dashboard");
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [student, setStudent] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const [studentData, tasksData, automationData] = await Promise.all([
        api.getStudent(),
        api.getTasks(),
        api.getAutomations()
      ]);
      setStudent(studentData);
      setTasks(tasksData);
      setAutomations(automationData);
    } catch (error) {
      showToast(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStudent(null);
      setTasks([]);
      setAutomations([]);
      if (nextSession) window.setTimeout(loadAll, 0);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadAll();
  }, [session?.user?.id]);

  function showToast(message) {
    setToast(message);
    window.clearTimeout(window.__campusToast);
    window.__campusToast = window.setTimeout(() => setToast(""), 3500);
  }

  const pendingTasks = tasks.filter((task) => task.status !== "completed");

  if (!authReady) return <div className="loading-screen">Loading CampusFlow…</div>;
  if (!session) return <AuthPage />;
  if (loading) return <div className="loading-screen">Loading your CampusFlow account…</div>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CF</div>
          <div>
            <strong>CampusFlow</strong>
            <span>Student productivity hub</span>
          </div>
        </div>

        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setPage(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <span className="pill success">n8n Ready</span>
          <h4>Automation-first</h4>
          <p>Connect your production webhook URLs in the backend .env file.</p>
        </div>
      </aside>

      <main className="main-content">
        <TopBar student={student} pendingTasks={pendingTasks.length} onSignOut={() => supabase.auth.signOut()} />

        {!student && page !== "profile" ? (
          <Onboarding onSaved={(saved) => { setStudent(saved); setPage("dashboard"); showToast("Profile created."); }} />
        ) : (
          <>
            {page === "dashboard" && (
              <Dashboard student={student} tasks={tasks} automations={automations} setPage={setPage} />
            )}
            {page === "tasks" && (
              <Tasks
                tasks={tasks}
                onChanged={async () => {
                  await loadAll();
                  showToast("Tasks updated.");
                }}
                showToast={showToast}
              />
            )}
            {page === "notice" && <Notice student={student} showToast={showToast} onBroadcast={loadAll} />}
            {page === "attendance" && <Attendance showToast={showToast} onChecked={loadAll} />}
            {page === "automations" && (
              <Automations automations={automations} onRefresh={loadAll} />
            )}
            {page === "profile" && (
              <Onboarding
                student={student}
                onSaved={(saved) => {
                  setStudent(saved);
                  showToast("Profile saved.");
                }}
              />
            )}
          </>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}


function AuthPage() {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password
        });
        if (error) throw error;
        setMessage(data.session
          ? "Account created. Complete your student profile."
          : "Account created. Check your email to confirm it, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password
        });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-brand">
        <div className="brand-mark">CF</div>
        <div>
          <h1>CampusFlow</h1>
          <p>Every student gets a private dashboard, task list and automation history.</p>
        </div>
      </div>

      <form className="panel auth-card form-stack" onSubmit={submit}>
        <p className="eyebrow">Secure multi-user access</p>
        <h2>{mode === "signin" ? "Welcome back" : "Create student account"}</h2>

        <Field label="Email address">
          <input required type="email" value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="student@gmail.com" />
        </Field>

        <Field label="Password">
          <input required type="password" minLength="6" value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="Minimum 6 characters" />
        </Field>

        {message && <div className="error-box">{message}</div>}

        <button className="primary-btn full" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        <button type="button" className="text-btn"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>
          {mode === "signin" ? "New student? Create an account" : "Already registered? Sign in"}
        </button>
      </form>
    </div>
  );
}

function TopBar({ student, pendingTasks, onSignOut }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">CampusAI Hackathon</p>
        <h1>Good day{student?.name ? `, ${student.name.split(" ")[0]}` : ""}</h1>
      </div>
      <div className="topbar-actions">
        <div className="notification">🔔 <span>{pendingTasks}</span></div>
        <div className="avatar">{student?.name?.slice(0, 2).toUpperCase() || "ST"}</div>
        <button className="secondary-btn" onClick={onSignOut}>Sign out</button>
      </div>
    </header>
  );
}

function Dashboard({ student, tasks, automations, setPage }) {
  const upcoming = [...tasks]
    .filter((task) => task.status !== "completed")
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 4);

  const completed = tasks.filter((task) => task.status === "completed").length;
  const successAutomations = automations.filter((item) => item.status === "success").length;

  return (
    <section>
      <div className="hero-card">
        <div>
          <span className="hero-badge">AI tip of the day</span>
          <h2>Break large assignments into 25-minute focus blocks.</h2>
          <p>Small, scheduled sessions are easier to complete than one long study marathon.</p>
          <button className="primary-btn" onClick={() => setPage("tasks")}>Add a deadline</button>
        </div>
        <div className="hero-visual">📚</div>
      </div>

      <div className="stats-grid">
        <StatCard label="Pending tasks" value={tasks.length - completed} caption="Needs attention" />
        <StatCard label="Completed" value={completed} caption="Great progress" />
        <StatCard label="Automation success" value={successAutomations} caption="n8n executions" />
        <StatCard label="Subjects" value={student?.subjects?.length || 0} caption={student?.branch || "Student"} />
      </div>

      <div className="two-column">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Schedule</p>
              <h3>Upcoming deadlines</h3>
            </div>
            <button className="text-btn" onClick={() => setPage("tasks")}>View all</button>
          </div>
          <div className="timeline">
            {upcoming.length ? upcoming.map((task) => (
              <div className="timeline-item" key={task.id}>
                <div className="date-chip">
                  <strong>{new Date(task.deadline).getDate()}</strong>
                  <span>{new Date(task.deadline).toLocaleString("en", { month: "short" })}</span>
                </div>
                <div>
                  <h4>{task.title}</h4>
                  <p>{task.subject} · {formatDate(task.deadline)}</p>
                </div>
                <span className="pill warning">{task.status}</span>
              </div>
            )) : <Empty text="No deadlines yet." />}
          </div>
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Automation</p>
              <h3>Recent activity</h3>
            </div>
            <button className="text-btn" onClick={() => setPage("automations")}>Open logs</button>
          </div>
          <div className="activity-list">
            {automations.slice(0, 5).map((item) => (
              <div className="activity-item" key={item.id}>
                <div className={`status-dot ${item.status}`}></div>
                <div>
                  <h4>{titleCase(item.type)} workflow</h4>
                  <p>{item.responseMessage}</p>
                </div>
                <small>{timeAgo(item.createdAt)}</small>
              </div>
            ))}
            {!automations.length && <Empty text="Automation events will appear here." />}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, caption }) {
  return (
    <div className="stat-card">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{caption}</span>
    </div>
  );
}

function Tasks({ tasks, onChanged, showToast }) {
  const initial = {
    title: "",
    subject: "",
    deadline: "",
    reminderTime: "",
    addToCalendar: true
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api.createTask(form);
      setForm(initial);
      showToast(`Task created. Automation: ${result.automation.status}.`);
      await onChanged();
    } catch (error) {
      showToast(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(task) {
    await api.updateTask(task.id, {
      status: task.status === "completed" ? "pending" : "completed"
    });
    await onChanged();
  }

  async function remove(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    await api.deleteTask(task.id);
    await onChanged();
  }

  return (
    <section className="page-grid">
      <div className="panel sticky-panel">
        <p className="eyebrow">New task</p>
        <h2>Create a deadline</h2>
        <form className="form-stack" onSubmit={submit}>
          <Field label="Task title">
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="DBMS assignment" />
          </Field>
          <Field label="Subject">
            <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Database Management Systems" />
          </Field>
          <Field label="Deadline">
            <input required type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </Field>
          <Field label="WhatsApp reminder time">
            <input type="datetime-local" value={form.reminderTime} onChange={(e) => setForm({ ...form, reminderTime: e.target.value })} />
          </Field>
          <label className="switch-row">
            <input type="checkbox" checked={form.addToCalendar} onChange={(e) => setForm({ ...form, addToCalendar: e.target.checked })} />
            <span>Add to Google Calendar</span>
          </label>
          <button className="primary-btn full" disabled={saving}>{saving ? "Creating…" : "Create task"}</button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Task manager</p>
            <h2>All deadlines</h2>
          </div>
          <span className="pill">{tasks.length} tasks</span>
        </div>
        <div className="task-list">
          {tasks.map((task) => (
            <div className={`task-row ${task.status === "completed" ? "done" : ""}`} key={task.id}>
              <button className="check-btn" onClick={() => toggleComplete(task)}>
                {task.status === "completed" ? "✓" : ""}
              </button>
              <div className="task-main">
                <h4>{task.title}</h4>
                <p>{task.subject} · {formatDate(task.deadline)}</p>
                <div className="tag-row">
                  {task.addToCalendar && <span className="mini-tag">Calendar</span>}
                  {task.reminderTime && <span className="mini-tag">WhatsApp reminder</span>}
                </div>
              </div>
              <button className="danger-btn" onClick={() => remove(task)}>Delete</button>
            </div>
          ))}
          {!tasks.length && <Empty text="Create your first task." />}
        </div>
      </div>
    </section>
  );
}

function Notice({ student, showToast, onBroadcast }) {
  const [noticeText, setNoticeText] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [phoneList, setPhoneList] = useState(student?.phone || "");
  const [bullets, setBullets] = useState([]);
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);

  async function summarize() {
    setBusy(true);
    try {
      const result = await api.summarizeNotice(noticeText);
      setBullets(result.bullets);
      setSource(result.source);
      showToast("Notice summarized.");
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function broadcast() {
    setBusy(true);
    try {
      const result = await api.broadcastNotice({
        noticeText,
        eventTitle,
        eventDate,
        phoneList: phoneList.split(",").map((value) => value.trim()).filter(Boolean),
        aiSummary: bullets
      });
      showToast(`Broadcast request sent. Automation: ${result.automation.status}.`);
      await onBroadcast();
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-grid">
      <div className="panel">
        <p className="eyebrow">AI module</p>
        <h2>Notice summarizer</h2>
        <div className="form-stack">
          <Field label="Event title">
            <input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Internal Assessment Schedule" />
          </Field>
          <Field label="Event date">
            <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </Field>
          <Field label="WhatsApp recipients">
            <input value={phoneList} onChange={(e) => setPhoneList(e.target.value)} placeholder="+919876543210, +919812345678" />
          </Field>
          <Field label="College notice">
            <textarea rows="11" value={noticeText} onChange={(e) => setNoticeText(e.target.value)} placeholder="Paste the complete notice here…" />
          </Field>
          <button className="primary-btn full" onClick={summarize} disabled={busy || !noticeText}>
            {busy ? "Working…" : "Generate 3-bullet summary"}
          </button>
        </div>
      </div>

      <div className="panel summary-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Generated result</p>
            <h2>Notice TL;DR</h2>
          </div>
          {source && <span className="pill">{source}</span>}
        </div>
        <div className="summary-box">
          {bullets.length ? (
            <ul>{bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>
          ) : (
            <Empty text="Your three-point summary will appear here." />
          )}
        </div>
        <button
          className="secondary-btn full"
          onClick={broadcast}
          disabled={busy || bullets.length === 0 || !eventTitle || !eventDate}
        >
          Broadcast through n8n
        </button>
      </div>
    </section>
  );
}

function Attendance({ showToast, onChecked }) {
  const [form, setForm] = useState({
    subject: "",
    attended: "",
    total: "",
    requiredPercentage: "75"
  });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await api.checkAttendance(form);
      setResult(response);
      showToast(`Attendance checked. Automation: ${response.automation.status}.`);
      await onChecked();
    } catch (error) {
      showToast(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-grid">
      <div className="panel">
        <p className="eyebrow">AI module</p>
        <h2>Attendance risk alerter</h2>
        <form className="form-stack" onSubmit={submit}>
          <Field label="Subject">
            <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="DBMS" />
          </Field>
          <div className="form-row">
            <Field label="Classes attended">
              <input required type="number" min="0" value={form.attended} onChange={(e) => setForm({ ...form, attended: e.target.value })} />
            </Field>
            <Field label="Total classes">
              <input required type="number" min="1" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
            </Field>
          </div>
          <Field label="Required attendance percentage">
            <input required type="number" min="1" max="99" value={form.requiredPercentage} onChange={(e) => setForm({ ...form, requiredPercentage: e.target.value })} />
          </Field>
          <button className="primary-btn full" disabled={busy}>{busy ? "Calculating…" : "Check attendance risk"}</button>
        </form>
      </div>

      <div className="panel result-panel">
        <p className="eyebrow">Risk result</p>
        <h2>Attendance insight</h2>
        {result ? (
          <div className={result.atRisk ? "risk-card danger" : "risk-card safe"}>
            <div className="gauge">{result.currentPercentage}%</div>
            <h3>{result.atRisk ? "Action required" : "You are on track"}</h3>
            <p>{result.message}</p>
            <div className="result-grid">
              <div><span>Attended</span><strong>{result.attended}</strong></div>
              <div><span>Total</span><strong>{result.total}</strong></div>
              <div><span>Target</span><strong>{result.requiredPercentage}%</strong></div>
              <div><span>Classes needed</span><strong>{result.classesNeeded}</strong></div>
            </div>
          </div>
        ) : <Empty text="Enter attendance details to calculate risk." />}
      </div>
    </section>
  );
}

function Automations({ automations, onRefresh }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">n8n activity</p>
          <h2>Automation logs</h2>
        </div>
        <button className="secondary-btn" onClick={onRefresh}>Refresh</button>
      </div>
      <div className="automation-table">
        <div className="automation-row head">
          <span>Workflow</span>
          <span>Status</span>
          <span>Response</span>
          <span>Time</span>
        </div>
        {automations.map((item) => (
          <div className="automation-row" key={item.id}>
            <strong>{titleCase(item.type)}</strong>
            <span className={`pill ${item.status}`}>{item.status}</span>
            <span className="truncate">{item.responseMessage}</span>
            <span>{new Date(item.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
      {!automations.length && <Empty text="No automation attempts yet." />}
    </section>
  );
}

function Onboarding({ student, onSaved }) {
  const [form, setForm] = useState({
    name: student?.name || "",
    branch: student?.branch || "",
    year: student?.year || "3",
    subjects: student?.subjects?.join(", ") || "",
    phone: student?.phone || "",
    email: student?.email || ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = await api.saveStudent({
        ...form,
        subjects: form.subjects.split(",").map((value) => value.trim()).filter(Boolean)
      });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="onboarding-wrap">
      <div className="panel onboarding-card">
        <p className="eyebrow">Student onboarding</p>
        <h2>{student ? "Update your profile" : "Set up CampusFlow"}</h2>
        <p className="muted">Your phone number is used for WhatsApp automation and your Gmail address is used for Calendar events.</p>
        {error && <div className="error-box">{error}</div>}
        <form className="form-stack" onSubmit={submit}>
          <div className="form-row">
            <Field label="Full name">
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Viswanath R" />
            </Field>
            <Field label="Branch">
              <input required value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="Computer Science" />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Year">
              <select value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}>
                <option value="1">First year</option>
                <option value="2">Second year</option>
                <option value="3">Third year</option>
                <option value="4">Fourth year</option>
              </select>
            </Field>
            <Field label="Subjects">
              <input required value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} placeholder="DBMS, OS, AI" />
            </Field>
          </div>
          <div className="form-row">
            <Field label="WhatsApp phone">
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+919876543210" />
            </Field>
            <Field label="Google account">
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="student@gmail.com" />
            </Field>
          </div>
          <button className="primary-btn full" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
        </form>
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Empty({ text }) {
  return <div className="empty-state"><span>✦</span><p>{text}</p></div>;
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function titleCase(value) {
  return String(value || "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function timeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
