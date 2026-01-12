import { useState, useEffect } from 'react'
import { LockClosedIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

export function InvitePage({ token, onComplete }) {
  const [invite, setInvite] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    validateToken()
  }, [token])

  const validateToken = async () => {
    try {
      const res = await fetch(`/api/auth/invite/${token}`)
      if (res.ok) {
        const data = await res.json()
        setInvite(data)
      } else {
        const err = await res.json()
        setError(err.error || 'Einladung ungültig')
      }
    } catch (err) {
      setError('Verbindungsfehler')
    }
    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 4) {
      setError('Passwort muss mindestens 4 Zeichen haben')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwörter stimmen nicht überein')
      return
    }

    try {
      const res = await fetch(`/api/auth/invite/${token}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => onComplete(), 2000)
      } else {
        const err = await res.json()
        setError(err.error || 'Fehler beim Erstellen des Accounts')
      }
    } catch (err) {
      setError('Verbindungsfehler')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Einladung wird geprüft...</div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account erstellt!</h1>
          <p className="text-gray-600">Sie werden zur Anmeldung weitergeleitet...</p>
        </div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <ExclamationCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Einladung ungültig</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={onComplete}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            Zur Anmeldung
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <LockClosedIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Willkommen, {invite?.name}!</h1>
          <p className="text-gray-600 mt-2">Bitte vergeben Sie ein Passwort für Ihren Account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Benutzername</label>
            <input
              type="text"
              value={invite?.username || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mindestens 4 Zeichen"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Passwort bestätigen</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Account aktivieren
          </button>
        </form>
      </div>
    </div>
  )
}
