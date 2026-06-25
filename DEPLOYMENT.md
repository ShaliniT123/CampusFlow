# CampusFlow Cloud Deployment

CampusFlow is prepared for online deployment using:

- Frontend: Vercel
- Backend: Render
- Automation: n8n Cloud
- AI: Groq API
- WhatsApp: Twilio Sandbox through n8n
- Calendar: Google Calendar through n8n

The application does not need to run on your computer after deployment.

## Step 1 — Upload the project to GitHub

Create a new GitHub repository and upload the complete `CampusFlow` project.

Do not upload any real `.env` file or API key.

## Step 2 — Deploy the backend on Render

1. Sign in to Render.
2. Create a new Blueprint or Web Service.
3. Connect the GitHub repository.
4. Select `render.yaml` from the project root.
5. Add these environment variables:

```text
FRONTEND_URLS=https://your-campusflow.vercel.app
GROQ_API_KEY=your_key
GROQ_MODEL=llama-3.1-8b-instant
N8N_DEADLINE_WEBHOOK_URL=your_production_webhook
N8N_NOTICE_WEBHOOK_URL=your_production_webhook
N8N_ATTENDANCE_WEBHOOK_URL=your_production_webhook
```

After deployment, copy the backend address, for example:

```text
https://campusflow-backend.onrender.com
```

Test:

```text
https://campusflow-backend.onrender.com/api/health
```

## Step 3 — Deploy the frontend on Vercel

1. Sign in to Vercel.
2. Import the same GitHub repository.
3. Set the Root Directory to:

```text
frontend
```

4. Add the environment variable:

```text
VITE_API_URL=https://campusflow-backend.onrender.com/api
```

5. Deploy.

Vercel will provide an online URL similar to:

```text
https://campusflow.vercel.app
```

## Step 4 — Update Render CORS

Return to Render and set:

```text
FRONTEND_URLS=https://campusflow.vercel.app
```

Redeploy the backend after saving the variable.

## Step 5 — Configure n8n Cloud

Import these files:

```text
n8n-workflows/deadline-reminder.json
n8n-workflows/notice-broadcast.json
n8n-workflows/attendance-alert.json
```

For every workflow:

1. Add the Google Calendar credential where required.
2. Add the Twilio credential.
3. Confirm the WhatsApp Sandbox sender number.
4. Activate the workflow.
5. Copy the Production Webhook URL.
6. Add that URL to the matching Render environment variable.

## Step 6 — Final test

Open the Vercel application and complete this flow:

1. Register a student.
2. Create a task.
3. Confirm the Google Calendar event.
4. Confirm the WhatsApp message.
5. Paste a notice and generate its AI summary.
6. Broadcast the notice.
7. Open the Automations page and show the successful execution.

## Important limitation of the starter database

The included backend uses a JSON file for simple hackathon storage. Some cloud services may reset local files during redeployment.

For a short hackathon demonstration this is usually acceptable. For permanent production storage, replace the JSON storage with Supabase, Firebase or PostgreSQL.
