import { useState } from 'react'
import { XMarkIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

export function ImportMergeDialog({ preview, parsedData, onClose, onImport }) {
  const [selectedNew, setSelectedNew] = useState(new Set(preview.neu.map(n => n.vin)))
  const [selectedUpdate, setSelectedUpdate] = useState(new Set(preview.aktualisiert.map(u => u.vin)))
  const [importing, setImporting] = useState(false)

  const toggleNew = (vin) => {
    const next = new Set(selectedNew)
    if (next.has(vin)) next.delete(vin)
    else next.add(vin)
    setSelectedNew(next)
  }

  const toggleUpdate = (vin) => {
    const next = new Set(selectedUpdate)
    if (next.has(vin)) next.delete(vin)
    else next.add(vin)
    setSelectedUpdate(next)
  }

  const handleImport = async () => {
    setImporting(true)
    const vinsToImport = [...selectedNew, ...selectedUpdate]
    
    try {
      const res = await fetch('/api/db/import-selective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vinsToImport, parsedData })
      })
      const json = await res.json()
      if (json.success) {
        onImport && onImport(json.stats)
      }
    } catch (err) {
      console.error('Import error:', err)
    }
    setImporting(false)
  }

  const totalSelected = selectedNew.size + selectedUpdate.size

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Import-Vorschau</h3>
            <p className="text-sm text-gray-500">Wähle welche Daten importiert werden sollen</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-140px)]">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{preview.neu.length}</div>
              <div className="text-sm text-green-600">Neu</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-700">{preview.aktualisiert.length}</div>
              <div className="text-sm text-amber-600">Aktualisiert</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-500">{preview.unveraendert.length}</div>
              <div className="text-sm text-gray-500">Unverändert</div>
            </div>
          </div>

          {/* Neue Fahrzeuge */}
          {preview.neu.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-green-700">Neue Fahrzeuge</h4>
                <button 
                  onClick={() => setSelectedNew(new Set(preview.neu.map(n => n.vin)))}
                  className="text-xs text-green-600 hover:underline"
                >
                  Alle auswählen
                </button>
              </div>
              <div className="bg-green-50 rounded-lg divide-y divide-green-100">
                {preview.neu.map(item => (
                  <label key={item.vin} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-green-100/50">
                    <input
                      type="checkbox"
                      checked={selectedNew.has(item.vin)}
                      onChange={() => toggleNew(item.vin)}
                      className="w-4 h-4 text-green-600 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.kennzeichen}</div>
                      <div className="text-xs text-gray-500">{item.kunde || 'Kein Name'}</div>
                    </div>
                    <div className="text-xs text-green-600">
                      {item.quellen.join(', ')}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Aktualisierte Fahrzeuge */}
          {preview.aktualisiert.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-amber-700">Änderungen</h4>
                <button 
                  onClick={() => setSelectedUpdate(new Set(preview.aktualisiert.map(u => u.vin)))}
                  className="text-xs text-amber-600 hover:underline"
                >
                  Alle auswählen
                </button>
              </div>
              <div className="bg-amber-50 rounded-lg divide-y divide-amber-100">
                {preview.aktualisiert.map(item => (
                  <label key={item.vin} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-amber-100/50">
                    <input
                      type="checkbox"
                      checked={selectedUpdate.has(item.vin)}
                      onChange={() => toggleUpdate(item.vin)}
                      className="w-4 h-4 text-amber-600 rounded mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{item.kennzeichen}</div>
                      <div className="mt-1 space-y-1">
                        {item.aenderungen.map((a, i) => (
                          <div key={i} className="text-xs">
                            <span className="text-gray-500">{a.feld}:</span>
                            <span className="text-red-500 line-through ml-1">{a.alt || '–'}</span>
                            <span className="text-gray-400 mx-1">→</span>
                            <span className="text-green-600 font-medium">{a.neu}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Unverändert */}
          {preview.unveraendert.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-2">
                Unverändert ({preview.unveraendert.length})
              </h4>
              <div className="text-xs text-gray-400">
                {preview.unveraendert.slice(0, 10).map(u => u.kennzeichen).join(', ')}
                {preview.unveraendert.length > 10 && ` ... und ${preview.unveraendert.length - 10} weitere`}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {totalSelected} Fahrzeuge ausgewählt
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Abbrechen
            </button>
            <button
              onClick={handleImport}
              disabled={importing || totalSelected === 0}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
            >
              {importing ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Importiere...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  {totalSelected} importieren
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
