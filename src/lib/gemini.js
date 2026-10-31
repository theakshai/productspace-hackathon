// Gemini API helpers. The key is sent in a header (never in the URL) and is only
// ever stored in this browser's localStorage.
export const API_ROOT = 'https://generativelanguage.googleapis.com'
export const DEFAULT_MODEL = 'gemini-2.5-flash'

async function apiError(res) {
  let detail = ''
  try {
    const body = await res.json()
    detail = body?.error?.message || ''
  } catch {
    // no JSON body
  }
  return new Error(`Gemini API ${res.status}${detail ? `: ${detail}` : ''}`)
}

// Lists models that support generateContent. Used to validate the key and pick a model.
export async function listModels(apiKey) {
  const res = await fetch(`${API_ROOT}/v1beta/models?pageSize=200`, {
    headers: { 'x-goog-api-key': apiKey },
  })
  if (!res.ok) throw await apiError(res)
  const data = await res.json()
  return (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
}

// Picks the newest "flash" model from a list: fast and cheap, with long audio/video support.
export function pickDefaultModel(models) {
  const flash = models.filter((m) => /flash/.test(m) && !/(lite|image|tts|audio|live|thinking|exp)/.test(m))
  const score = (m) => {
    const v = parseFloat((m.match(/gemini-(\d+(\.\d+)?)/) || [])[1] || '0')
    return v * 10 + (/preview/.test(m) ? 0 : 1)
  }
  flash.sort((a, b) => score(b) - score(a))
  return flash[0] || models[0] || DEFAULT_MODEL
}

// Calls generateContent and returns parsed JSON that matches `schema`.
// `parts` is an array of Gemini content parts, e.g. [{ text }] or [{ file_data }, { text }].
export async function generateJSON({ apiKey, model, system, parts, schema, temperature = 0.4, signal }) {
  const res = await fetch(`${API_ROOT}/v1beta/models/${model || DEFAULT_MODEL}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  })
  if (!res.ok) throw await apiError(res)
  const data = await res.json()
  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts || []).map((p) => p.text || '').join('')
  if (!text) {
    const reason = candidate?.finishReason || data.promptFeedback?.blockReason || 'empty response'
    throw new Error(`Gemini returned no content (${reason})`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Gemini returned something that was not valid JSON. Try again.')
  }
}

// Resumable upload to the Gemini Files API with progress callbacks.
// onProgress({ stage: 'uploading' | 'processing' | 'ready', percent })
export async function uploadFile(apiKey, file, onProgress, signal) {
  const mimeType = file.type || 'application/octet-stream'

  // 1. Start a resumable upload session.
  const start = await fetch(`${API_ROOT}/upload/v1beta/files`, {
    method: 'POST',
    signal,
    headers: {
      'x-goog-api-key': apiKey,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: file.name } }),
  })
  if (!start.ok) throw await apiError(start)
  const uploadUrl = start.headers.get('x-goog-upload-url')
  if (!uploadUrl) throw new Error('Gemini did not return an upload URL')

  // 2. Send the bytes with XHR so we get real upload progress.
  const uploaded = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', uploadUrl)
    xhr.setRequestHeader('X-Goog-Upload-Command', 'upload, finalize')
    xhr.setRequestHeader('X-Goog-Upload-Offset', '0')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress({ stage: 'uploading', percent: Math.round((e.loaded / e.total) * 100) })
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText).file)
        } catch {
          reject(new Error('Could not read the upload response'))
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    if (signal) signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(file)
  })

  // 3. Video needs server-side processing before it can be used. Poll until ACTIVE.
  let current = uploaded
  const started = Date.now()
  while (current.state === 'PROCESSING') {
    onProgress({ stage: 'processing', percent: 100 })
    if (Date.now() - started > 10 * 60 * 1000) throw new Error('Gemini is taking too long to process this file')
    await new Promise((r) => setTimeout(r, 3000))
    if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError')
    const res = await fetch(`${API_ROOT}/v1beta/${current.name}`, {
      headers: { 'x-goog-api-key': apiKey },
      signal,
    })
    if (!res.ok) throw await apiError(res)
    current = await res.json()
  }
  if (current.state === 'FAILED') throw new Error('Gemini could not process this file')

  onProgress({ stage: 'ready', percent: 100 })
  return {
    name: current.name,
    uri: current.uri,
    mimeType: current.mimeType || mimeType,
    expiresAt: current.expirationTime || null,
  }
}
