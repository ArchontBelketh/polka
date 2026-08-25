// Вызов ИИ-провайдера. Провайдер/ключ/модель берутся из настроек админки
// (см. @/lib/ai-settings), а не из env.
import { getAiSettings, aiModel } from "@/lib/ai-settings"

export async function callAi(prompt: string): Promise<string | null> {
  const s = await getAiSettings()
  try {
    if (s.provider === "gemini" && s.apiKey) {
      return await callGemini(prompt, s.apiKey, aiModel(s))
    }
    if (s.provider === "yandexgpt" && s.apiKey && s.folderId) {
      return await callYandexGpt(prompt, s.apiKey, s.folderId, aiModel(s))
    }
  } catch (err) {
    console.error(`[ai-review] provider ${s.provider} failed:`, err)
  }
  return null
}

async function callGemini(prompt: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  return data.candidates[0].content.parts[0].text
}

async function callYandexGpt(
  prompt: string,
  apiKey: string,
  folderId: string,
  model: string,
): Promise<string> {
  const res = await fetch("https://llm.api.cloud.yandex.net/foundationModels/v1/completion", {
    method: "POST",
    headers: {
      Authorization: `Api-Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelUri: `gpt://${folderId}/${model}`,
      completionOptions: { stream: false, temperature: 0.1, maxTokens: 2000 },
      messages: [{ role: "user", text: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`YandexGPT ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as {
    result: { alternatives: Array<{ message: { text: string } }> }
  }
  return data.result.alternatives[0].message.text
}
