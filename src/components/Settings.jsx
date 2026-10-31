import { useState } from 'react'
import { listModels, pickDefaultModel } from '../lib/gemini.js'

export default function Settings({ settings, onSave, onClose }) {
  const [apiKey, setApiKey] = useState(settings.apiKey || '')
  const [model, setModel] = useState(settings.model || '')
  const [models, setModels] = useState([])
  const [status, setStatus] = useState(null)

  async function testKey() {
    setStatus({ kind: 'busy', text: 'Checking key…' })
    try {
      const found = await listModels(apiKey.trim())
      setModels(found)
      const chosen = model && found.includes(model) ? model : pickDefaultModel(found)
      setModel(chosen)
      setStatus({ kind: 'ok', text: `Key works. Using ${chosen}.` })
    } catch (e) {
      setStatus({ kind: 'error', text: e.message })
    }
  }

  function save() {
    onSave({ ...settings, apiKey: apiKey.trim(), model: model || settings.model })
    onClose()
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="modal">
        <h2>Settings</h2>
        <p className="muted small">
          Your Gemini key is stored only in this browser. It is never sent anywhere except Google's API.
        </p>

        <label className="field">
          <span>Gemini API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your key from aistudio.google.com"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Model</span>
          {models.length ? (
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Click “Test key” to choose" />
          )}
        </label>

        {status && <p className={`status ${status.kind}`}>{status.text}</p>}

        <div className="row end">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={testKey} disabled={!apiKey.trim()}>
            Test key
          </button>
          <button className="btn primary" onClick={save} disabled={!apiKey.trim()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
