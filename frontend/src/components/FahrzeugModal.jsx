import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

export function FahrzeugModal({ fahrzeugId, token, onClose }) {
  const [fahrzeug, setFahrzeug] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFahrzeug()
  }, [fahrzeugId])

  const loadFahrzeug = async () => {
    try {
      const res = await fetch(`/api/db/fahrzeuge/${fahrzeugId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setFahrzeug(data)
      }
    } catch (err) {
      console.error('Fahrzeug laden fehlgeschlagen:', err)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl p-8" onClick={e => e.stopPropagation()}>
          <div className="text-gray-500">Laden...</div>
        </div>
      </div>
    )
  }

  if (!fahrzeug) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl p-8" onClick={e => e.stopPropagation()}>
          <div className="text-gray-500">Fahrzeug nicht gefunden</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">{fahrzeug.kennzeichen}</h3>
            <p className="text-sm text-gray-500">{fahrzeug.vin}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Fahrzeugdaten */}
          <div>
            <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">Fahrzeug</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Hersteller:</span>
                <span className="ml-2 text-gray-900">{fahrzeug.hersteller || '–'}</span>
              </div>
              <div>
                <span className="text-gray-500">Erstzulassung:</span>
                <span className="ml-2 text-gray-900">{fahrzeug.erstzulassung || '–'}</span>
              </div>
            </div>
          </div>

          {/* Kunde */}
          {fahrzeug.kunde && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">Kunde</h4>
              <div className="text-sm space-y-1">
                <div className="text-gray-900 font-medium">{fahrzeug.kunde.name}</div>
                {fahrzeug.kunde.strasse && (
                  <div className="text-gray-500">{fahrzeug.kunde.strasse}</div>
                )}
                {(fahrzeug.kunde.plz || fahrzeug.kunde.ort) && (
                  <div className="text-gray-500">{fahrzeug.kunde.plz} {fahrzeug.kunde.ort}</div>
                )}
                {fahrzeug.kunde.telefon && (
                  <div className="text-gray-500">Tel: {fahrzeug.kunde.telefon}</div>
                )}
              </div>
            </div>
          )}

          {/* Termine */}
          {fahrzeug.termine?.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase mb-2">Termine</h4>
              <div className="space-y-1">
                {fahrzeug.termine.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">{t.typ?.toUpperCase()}</span>
                    <span className="text-gray-900">{t.datum}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
