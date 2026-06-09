// AI provider abstraction — switch via AI_REVIEW_PROVIDER env var

export type AiProvider = "gemini" | "ollama" | "yandexgpt" | "disabled"

const PROVIDER = (process.env.AI_REVIEW_PROVIDER ?? "disabled") as AiProvider

export async function callAi(prompt: string): Promise<string | null> {
  if (PROVIDER === "disabled") return null

  try {
    if (PROVIDER === "gemini") return await callGemini(prompt)
    if (PROVIDER === "ollama") return await callOllama(prompt)
    if (PROVIDER === "yandexgpt") return await callYandexGpt(prompt)
  } catch (err) {
    console.error(`[ai-review] provider ${PROVIDER} failed:`, err)
  }
  return null
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY not set")

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(30000),
    },
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  return data.candidates[0].content.parts[0].text
}

async function callOllama(prompt: string): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
  const model = process.env.OLLAMA_MODEL ?? "gemma3:12b"

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, format: "json", stream: false }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`)
  const data = await res.json() as { response: string }
  return data.response
}

async function callYandexGpt(prompt: string): Promise<string> {
  const apiKey = process.env.YANDEX_GPT_API_KEY
  const folderId = process.env.YANDEX_FOLDER_ID
  if (!apiKey || !folderId) throw new Error("YANDEX_GPT_API_KEY or YANDEX_FOLDER_ID not set")

  const res = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
    method: "POST",
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelUri: `gpt://${folderId}/yandexgpt-lite`,
      completionOptions: { stream: false, temperature: 0.1, maxTokens: 2000 },
      messages: [{ role: "user", text: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`YandexGPT ${res.status}: ${await res.text()}`)
  const data = await res.json() as {
    result: { alternatives: Array<{ message: { text: string } }> }
  }
  return data.result.alternatives[0].message.text
}
