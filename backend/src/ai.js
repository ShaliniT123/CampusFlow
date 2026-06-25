function fallbackSummary(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return [
      "No notice content was provided.",
      "Add the full notice text to generate a useful summary.",
      "Verify the event date before broadcasting."
    ];
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const datePattern = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[a-z]*\s+\d{2,4})\b/i;
  const actionWords = /(submit|attend|report|register|bring|complete|pay|upload|download|collect|mandatory|required)/i;

  const dateSentence = sentences.find((s) => datePattern.test(s));
  const actionSentence = sentences.find((s) => actionWords.test(s));

  const picks = [
    sentences[0],
    dateSentence,
    actionSentence
  ].filter(Boolean);

  const unique = [...new Set(picks)];
  while (unique.length < 3 && sentences[unique.length]) {
    unique.push(sentences[unique.length]);
  }

  return unique.slice(0, 3).map((item) => item.replace(/^[-•]\s*/, ""));
}

export async function summarizeNotice(text) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  if (!apiKey) {
    return {
      bullets: fallbackSummary(text),
      source: "offline-fallback"
    };
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "Summarize the college notice into exactly 3 concise bullet points. Include the main announcement, relevant date or deadline, and required student action. Return JSON only in the form {\"bullets\":[\"...\",\"...\",\"...\"]}."
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Groq request failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed.bullets) || parsed.bullets.length === 0) {
      throw new Error("AI response did not contain bullets.");
    }

    return {
      bullets: parsed.bullets.slice(0, 3),
      source: "groq"
    };
  } catch (error) {
    return {
      bullets: fallbackSummary(text),
      source: "offline-fallback",
      warning: error.message
    };
  }
}
