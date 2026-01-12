import { useState, useEffect } from 'react'
import { CalendarIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export function BuchungsSeite() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [selectedDatum, setSelectedDatum] = useState(null)
  const [buchend, setBuchend] = useState(false)
  const [erfolg, setErfolg] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [kennzeichenInput, setKennzeichenInput] = useState('')
  const [verifiziert, setVerifiziert] = useState(false)
  const [token, setToken] = useState(null)

  const handleVerifizieren = async () => {
    if (!codeInput.trim() || !kennzeichenInput.trim()) return
    setLoading(true)
    setError(null)
    
    const code = codeInput.trim().toUpperCase()
    
    try {
      const res = await fetch(`/api/buchung/token/${code}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kennzeichen: kennzeichenInput.trim().toUpperCase() })
      })
      
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Code oder Kennzeichen ungültig')
        setLoading(false)
        return
      }
      
      const info = await res.json()
      setData(info)
      setToken(code)
      setVerifiziert(true)
      
      if (info.status === 'gebucht') {
        setErfolg(true)
        setSelectedDatum(info.gewaehltes_datum)
      }
    } catch (err) {
      setError('Verbindungsfehler')
    }
    setLoading(false)
  }

  const handleBuchen = async () => {
    if (!selectedDatum) return
    setBuchend(true)
    
    try {
      const res = await fetch(`/api/buchung/token/${token}/buchen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datum: selectedDatum })
      })
      
      if (!res.ok) {
        const err = await res.json()
        setError(err.error)
        setBuchend(false)
        return
      }
      
      setErfolg(true)
    } catch (err) {
      setError('Buchung fehlgeschlagen')
    }
    setBuchend(false)
  }

  const formatDatum = (dateStr) => {
    const d = new Date(dateStr)
    return `${WOCHENTAGE[d.getDay()]}, ${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Laden...</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <ExclamationCircleIcon className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Fehler</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  // Code + Kennzeichen Eingabe
  if (!verifiziert) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Termin buchen</h1>
            <p className="text-gray-500 mt-2">Geben Sie Ihren Buchungscode und Ihr Kennzeichen ein</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buchungscode</label>
              <input
                type="text"
                placeholder="z.B. ABC123"
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setError(null); }}
                className="w-full px-4 py-3 text-center text-2xl font-bold tracking-widest border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent uppercase"
                maxLength={6}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kennzeichen</label>
              <input
                type="text"
                placeholder="z.B. B-AB 1234"
                value={kennzeichenInput}
                onChange={(e) => { setKennzeichenInput(e.target.value.toUpperCase()); setError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifizieren()}
                className="w-full px-4 py-3 text-center text-lg font-medium border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent uppercase"
              />
            </div>
            
            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              onClick={handleVerifizieren}
              disabled={!codeInput.trim() || !kennzeichenInput.trim() || loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {loading ? 'Wird geprüft...' : 'Weiter'}
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-6">
            Den Buchungscode und Ihr Kennzeichen finden Sie in dem Schreiben, das Sie erhalten haben.
          </p>
        </div>
      </div>
    )
  }

  if (erfolg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircleIcon className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Termin gebucht!</h1>
          <p className="text-gray-500 mb-4">
            Ihr Termin für <span className="font-medium text-gray-900">{data?.kennzeichen}</span> wurde bestätigt.
          </p>
          <div className="bg-emerald-50 rounded-lg p-4">
            <p className="text-emerald-800 font-medium">{formatDatum(selectedDatum)}</p>
          </div>
          <p className="text-sm text-gray-400 mt-6">Sie können dieses Fenster jetzt schließen.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Termin buchen</h1>
              <p className="text-gray-500">Wählen Sie Ihren Wunschtermin</p>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Fahrzeug:</span>
              <span className="font-medium text-gray-900">{data?.kennzeichen}</span>
            </div>
            {data?.kunde_name && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-gray-500">Kunde:</span>
                <span className="text-gray-900">{data.kunde_name}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-500">Termin für:</span>
              <span className="text-gray-900 capitalize">{data?.typ}</span>
            </div>
          </div>
        </div>

        {/* Verfügbare Termine */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="font-medium text-gray-900 mb-4">Verfügbare Termine</h2>
          
          {data?.verfuegbareTage?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Leider sind aktuell keine Termine verfügbar.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {data?.verfuegbareTage?.map((tag) => (
                <button
                  key={tag.datum}
                  onClick={() => setSelectedDatum(tag.datum)}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    selectedDatum === tag.datum
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-left">
                    <div className="font-medium text-gray-900">{formatDatum(tag.datum)}</div>
                    <div className="text-sm text-gray-500">
                      {tag.frei} {tag.frei === 1 ? 'Platz' : 'Plätze'} frei
                    </div>
                  </div>
                  {selectedDatum === tag.datum && (
                    <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Buchen Button */}
          {selectedDatum && (
            <button
              onClick={handleBuchen}
              disabled={buchend}
              className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {buchend ? 'Wird gebucht...' : 'Termin verbindlich buchen'}
            </button>
          )}
        </div>

        <p className="text-center text-sm text-gray-400 mt-6">
          Auto Walther Service
        </p>
      </div>
    </div>
  )
}
