# n8n workflow templates

Import the JSON files into n8n.

After import:

1. Replace the placeholder Google Calendar credential.
2. Replace the placeholder Twilio credential.
3. Confirm the Twilio WhatsApp Sandbox sender number.
4. Activate each workflow.
5. Copy each production webhook URL into `backend/.env`.

The notice template currently sends to the first number in `phoneList`. To support multiple recipients, add a Loop Over Items node before the Twilio node and split the `phoneList` array into individual items.
