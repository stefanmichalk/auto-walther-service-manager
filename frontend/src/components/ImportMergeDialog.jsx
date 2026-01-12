import { useState, useEffect } from 'react'
import { 
  XMarkIcon, 
  CheckIcon, 
  ArrowPathIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  UserIcon,
  TruckIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'

export function ImportMergeDialog({ preview, parsedData, onClose, onImport, token }) {
  // Alle Datensätze zusammenführen für Wizard
  const allRecords = [
    ...preview.neu.map(r => ({ ...r, type: 'neu' })),
    ...preview.aktualisiert.map(r => ({ ...r, type: 'aktualisiert' }))
  ]
  
  const [currentIndex, setCurrentIndex] = useState(0)
  const [decisions, setDecisions] = useState(() => {
    // Standardmäßig alle ausgewählt
    const d = {}
    allRecords.forEach(r => { d[r.vin] = true })
    return d
  })
  const [importing, setImporting] = useState(false)
  const [view, setView] = useState(allRecords.length > 0 ? 'wizard' : 'summary') // 'wizard' oder 'summary'

  const currentRecord = allRecords[currentIndex]
  const selectedCount = Object.values(decisions).filter(Boolean).length

  const handleDecision = (vin, include) => {
    setDecisions(prev => ({ ...prev, [vin]: include }))
  }

  const handleNext = () => {
    if (currentIndex < allRecords.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setView('summary')
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  // Enter-Taste zum Bestätigen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (view !== 'wizard' || importing) return
      if (e.key === 'Enter') {
        e.preventDefault()
        handleDecision(currentRecord?.vin, true)
        handleNext()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, importing, currentRecord, currentIndex])

  const handleImport = async () => {
    setImporting(true)
    const vinsToImport = Object.entries(decisions).filter(([_, v]) => v).map(([k]) => k)
    
    try {
      const res = await fetch('/api/db/import-selective', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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

  // Wizard View - Einzelner Datensatz
  if (view === 'wizard' && currentRecord) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4">
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                currentRecord.type === 'neu' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {currentRecord.type === 'neu' ? 'NEU' : 'AKTUALISIERUNG'}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{currentRecord.kennzeichen || 'Unbekannt'}</h3>
                <p className="text-xs text-gray-500 font-mono">{currentRecord.vin}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {currentIndex + 1} von {allRecords.length}
              </span>
              <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-gray-100">
            <div 
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / allRecords.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Linke Spalte: Fahrzeug */}
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  <TruckIcon className="w-4 h-4" />
                  Fahrzeug
                </h4>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="text-xs text-gray-400">Kennzeichen</label>
                    <p className="text-lg font-bold text-gray-900">{currentRecord.kennzeichen || '–'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Fahrgestellnummer (VIN)</label>
                    <p className="text-sm font-mono text-gray-700">{currentRecord.vin}</p>
                  </div>
                  {currentRecord.faelligkeit && (
                    <div>
                      <label className="text-xs text-gray-400">Service-Fälligkeit</label>
                      <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        {currentRecord.faelligkeit}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Rechte Spalte: Kunde */}
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  <UserIcon className="w-4 h-4" />
                  Kundendaten
                </h4>
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div>
                    <label className="text-xs text-gray-400">Name</label>
                    <p className={`text-base font-medium ${currentRecord.kunde ? 'text-gray-900' : 'text-red-400'}`}>
                      {currentRecord.kunde || 'FEHLT!'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPinIcon className="w-3 h-3" /> Adresse
                    </label>
                    <p className={`text-sm ${currentRecord.adresse ? 'text-gray-900' : 'text-red-400'}`}>
                      {currentRecord.adresse || 'FEHLT!'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400">PLZ</label>
                      <p className={`text-sm ${currentRecord.plz ? 'text-gray-900' : 'text-red-400'}`}>
                        {currentRecord.plz || 'FEHLT!'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Ort</label>
                      <p className={`text-sm ${currentRecord.ort ? 'text-gray-900' : 'text-red-400'}`}>
                        {currentRecord.ort || 'FEHLT!'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 flex items-center gap-1">
                      <PhoneIcon className="w-3 h-3" /> Telefon
                    </label>
                    <p className={`text-sm ${currentRecord.telefon ? 'text-gray-900' : 'text-gray-400'}`}>
                      {currentRecord.telefon || '–'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 flex items-center gap-1">
                      <PhoneIcon className="w-3 h-3" /> Handy
                    </label>
                    <p className={`text-sm ${currentRecord.handy ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                      {currentRecord.handy || '–'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 flex items-center gap-1">
                      <EnvelopeIcon className="w-3 h-3" /> E-Mail
                    </label>
                    <p className={`text-sm ${currentRecord.email ? 'text-gray-900' : 'text-gray-400'}`}>
                      {currentRecord.email || '–'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Änderungen bei Aktualisierung */}
            {currentRecord.type === 'aktualisiert' && currentRecord.aenderungen?.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-amber-700 mb-3">
                  {currentRecord.aenderungen.every(a => !a.alt) ? 'Neue Termine' : 'Änderungen'}
                </h4>
                <div className="bg-amber-50 rounded-xl p-4 space-y-2">
                  {currentRecord.aenderungen.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="w-32 text-gray-500 font-medium">{a.feld}:</span>
                      {a.alt ? (
                        <>
                          <span className="text-red-500 line-through">{a.alt}</span>
                          <span className="text-gray-400">→</span>
                        </>
                      ) : (
                        <span className="text-emerald-500 text-xs font-medium px-2 py-0.5 bg-emerald-100 rounded">NEU</span>
                      )}
                      <span className="text-emerald-600 font-semibold">{a.neu}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quelle */}
            <div className="mt-6 text-xs text-gray-400">
              Quelle: {currentRecord.quellen?.join(', ') || 'Unbekannt'}
            </div>

            {/* Parsing-Hinweise */}
            {currentRecord._parseHints?.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-1">Parsing-Anpassungen:</p>
                <ul className="text-xs text-gray-500 space-y-0.5">
                  {currentRecord._parseHints.map((hint, idx) => (
                    <li key={idx}>· {hint}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* DEBUG: Raw JSON */}
            <details className="mt-4">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                🔍 Debug: Raw JSON anzeigen
              </summary>
              <pre className="mt-2 p-3 bg-gray-900 text-green-400 text-xs rounded-lg overflow-auto max-h-64">
                {JSON.stringify(currentRecord, null, 2)}
              </pre>
            </details>
          </div>

          {/* Footer mit Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
            <div className="flex items-center gap-4">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Zurück
              </button>
              <button
                onClick={() => setView('summary')}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Übersicht
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { handleDecision(currentRecord.vin, false); handleNext(); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Überspringen
              </button>
              <button
                onClick={() => { handleDecision(currentRecord.vin, true); handleNext(); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
              >
                <CheckIcon className="w-4 h-4" />
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Summary View
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Import-Zusammenfassung</h3>
            <p className="text-sm text-gray-500">{selectedCount} von {allRecords.length} Datensätzen ausgewählt</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-160px)]">
          {/* Stats - dezenter */}
          <div className="flex items-center gap-6 mb-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold text-gray-900">{preview.neu.length}</span>
              <span className="text-gray-500">Neu</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold text-gray-900">{preview.aktualisiert.length}</span>
              <span className="text-gray-500">Updates</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold text-gray-400">{preview.unveraendert.length}</span>
              <span className="text-gray-400">Unverändert</span>
            </div>
          </div>

          {/* Liste der ausgewählten */}
          <div className="space-y-1">
            {allRecords.map((record, i) => (
              <div 
                key={record.vin}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                  decisions[record.vin] ? '' : 'opacity-40'
                }`}
                onClick={() => handleDecision(record.vin, !decisions[record.vin])}
              >
                {/* Custom Checkbox - rund */}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  decisions[record.vin] ? 'bg-emerald-600' : 'bg-gray-200'
                }`}>
                  {decisions[record.vin] && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{record.kennzeichen}</span>
                    <span className="text-xs text-gray-400">
                      {record.type === 'neu' ? 'Neu' : 'Update'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {record.kunde || '–'} • {record.adresse || '–'} • {record.plz} {record.ort}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(i); setView('wizard'); }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Details
                </button>
              </div>
            ))}
          </div>

          {allRecords.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <p>Keine Änderungen gefunden.</p>
              <p className="text-sm mt-2">Die Daten sind bereits aktuell.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          {allRecords.length > 0 && (
            <button
              onClick={() => { setCurrentIndex(0); setView('wizard'); }}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ← Nochmal durchgehen
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl"
            >
              Abbrechen
            </button>
            <button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className="px-6 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {importing ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Importiere...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  {selectedCount} importieren
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
