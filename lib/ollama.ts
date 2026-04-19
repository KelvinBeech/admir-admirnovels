const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:e4b";
const OLLAMA_NARRATIVE_TIMEOUT_MS = 10 * 60_000;

export async function callOllamaText(system: string, user: string, model = OLLAMA_MODEL, timeoutMs = OLLAMA_NARRATIVE_TIMEOUT_MS): Promise<string> {
  let res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: false,
    }),
  });

  if (res.status === 404 || res.status === 405) {
    res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model,
        prompt: `${system}\n\nUser: ${user}\n\nAssistant:`,
        stream: false,
      }),
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text ? `Ollama request failed (${res.status}): ${text}` : `Ollama request failed (${res.status})`);
  }

  const data = (await res.json().catch(() => ({}))) as { message?: { content?: string }; response?: string };
  const content = typeof data?.message?.content === "string"
    ? data.message.content
    : typeof data?.response === "string"
      ? data.response
      : "";

  if (!content) {
    throw new Error("Ollama returned an empty response");
  }

  return content;
}
