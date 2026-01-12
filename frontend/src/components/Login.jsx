import { useState } from 'react'
import { LockClosedIcon, UserIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

export function Login({ onLogin, setupRequired }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = setupRequired ? '/api/auth/setup' : '/api/auth/login'
      const body = setupRequired 
        ? { username, password, name: name || 'Administrator' }
        : { username, password }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login fehlgeschlagen')
        setLoading(false)
        return
      }

      if (setupRequired) {
        // Nach Setup direkt einloggen
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
        const loginData = await loginRes.json()
        if (loginRes.ok) {
          onLogin(loginData.token, loginData.user)
        }
      } else {
        onLogin(data.token, data.user)
      }
    } catch (err) {
      setError('Verbindungsfehler')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50">
          <div className="mb-8">
            <h1 className="text-xl font-semibold text-slate-900">
              ServiceManager
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {setupRequired ? 'Admin-Account erstellen' : 'Auto Walther'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {setupRequired && (
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Anzeigename
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Max Mustermann"
                  className="w-full px-3 py-2.5 border border-slate-200 text-sm focus:border-slate-900 focus:ring-0 outline-none transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Benutzername
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2.5 border border-slate-200 text-sm focus:border-slate-900 focus:ring-0 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Passwort
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 pr-10 border border-slate-200 text-sm focus:border-slate-900 focus:ring-0 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-3 py-2 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Laden...' : (setupRequired ? 'Erstellen' : 'Anmelden')}
            </button>
          </form>

          {setupRequired && (
            <p className="mt-6 text-center text-xs text-slate-400">
              Ersteinrichtung — erster Account wird Admin
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
