import { useState, useEffect } from 'react'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  ClockIcon, 
  CalendarDaysIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
  CircleStackIcon,
  PlusIcon,
  EnvelopeIcon,
  PhoneIcon,
  EllipsisVerticalIcon,
  XMarkIcon,
  TrashIcon,
  ArrowPathIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'
import { TerminForm } from './TerminForm'
import { ImportMergeDialog } from './ImportMergeDialog'

export function FaelligkeitenList({ data, onRefresh, currentUser }) {
  const [showForm, setShowForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [statusMap, setStatusMap] = useState({})
  const [openMenu, setOpenMenu] = useState(null)
  const [modal, setModal] = useState({ type: null, vin: null })
  const [modalData, setModalData] = useState({ grund: '', datum: '' })
  const [infoModal, setInfoModal] = useState(null)
  const [auditLog, setAuditLog] = useState([])
  const [termine, setTermine] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterUrgency, setFilterUrgency] = useState('alle')
  const [filterStatus, setFilterStatus] = useState('alle')
  const [importPreview, setImportPreview] = useState(null)
  const [parsedData, setParsedData] = useState(null)

  // Lade gespeicherte Status beim Mount
  useEffect(() => {
    fetch('/api/db/fahrzeug-status')
      .then(res => res.json())
      .then(statusList => {
        const map = {}
        statusList.forEach(s => {
          map[s.vin] = { 
            angeschrieben: !!s.angeschrieben, 
            service_termin: s.service_termin || '', 
            nachgefasst: !!s.nachgefasst,
            ausgetragen: !!s.ausgetragen,
            wiedervorlage_datum: s.wiedervorlage_datum || ''
          }
        })
        setStatusMap(map)
      })
      .catch(() => {})
  }, [data])

  const handleStatusChange = async (vin, field, value) => {
    const current = statusMap[vin] || { angeschrieben: false, service_termin: '', nachgefasst: false }
    const updated = { ...current, [field]: value }
    
    setStatusMap(prev => ({ ...prev, [vin]: updated }))
    
    try {
      await fetch('/api/db/fahrzeug-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin, ...updated, user_name: currentUser || 'Unbekannt' })
      })
    } catch (err) {
      console.error('Status update error:', err)
    }
  }

  const handleExport = () => {
    window.open('/api/faelligkeiten/export', '_blank')
  }

  const handleAustragen = async () => {
    if (!modal.vin || !modalData.grund) return
    try {
      await fetch('/api/db/fahrzeug-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          vin: modal.vin, 
          ausgetragen: true, 
          austragen_grund: modalData.grund,
          angeschrieben: statusMap[modal.vin]?.angeschrieben || false,
          service_termin: statusMap[modal.vin]?.service_termin || '',
          nachgefasst: statusMap[modal.vin]?.nachgefasst || false,
          user_name: currentUser || 'Unbekannt'
        })
      })
      setStatusMap(prev => ({ ...prev, [modal.vin]: { ...prev[modal.vin], ausgetragen: true } }))
    } catch (err) {
      console.error('Austragen error:', err)
    }
    setModal({ type: null, vin: null })
    setModalData({ grund: '', datum: '' })
  }

  const handleWiedervorlage = async () => {
    if (!modal.vin || !modalData.grund || !modalData.datum) return
    try {
      await fetch('/api/db/fahrzeug-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          vin: modal.vin, 
          wiedervorlage_datum: modalData.datum,
          wiedervorlage_grund: modalData.grund,
          angeschrieben: statusMap[modal.vin]?.angeschrieben || false,
          service_termin: statusMap[modal.vin]?.service_termin || '',
          nachgefasst: statusMap[modal.vin]?.nachgefasst || false,
          user_name: currentUser || 'Unbekannt'
        })
      })
      setStatusMap(prev => ({ ...prev, [modal.vin]: { ...prev[modal.vin], wiedervorlage_datum: modalData.datum } }))
    } catch (err) {
      console.error('Wiedervorlage error:', err)
    }
    setModal({ type: null, vin: null })
    setModalData({ grund: '', datum: '' })
  }

  const handleImportToDb = async () => {
    setImporting(true)
    try {
      // Erst geparste Daten holen
      const dataRes = await fetch('/api/data')
      const parsed = await dataRes.json()
      setParsedData(parsed)
      
      // Dann Vorschau erstellen
      const previewRes = await fetch('/api/db/import-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      })
      const previewJson = await previewRes.json()
      
      if (previewJson.success) {
        // Wenn alles neu ist, direkt importieren
        if (previewJson.summary.aktualisiert === 0 && previewJson.summary.unveraendert === 0) {
          // Direkter Import
          const importRes = await fetch('/api/db/import-current', { method: 'POST' })
          const importJson = await importRes.json()
          if (importJson.success) {
            alert(`Import erfolgreich!\n${importJson.stats.fahrzeuge} Fahrzeuge\n${importJson.stats.termine} Termine\n${importJson.stats.service} Service-Fälligkeiten`)
            onRefresh && onRefresh()
          }
        } else {
          // Dialog zeigen
          setImportPreview(previewJson.preview)
        }
      }
    } catch (err) {
      console.error('Import error:', err)
    }
    setImporting(false)
  }

  const handleImportComplete = (stats) => {
    setImportPreview(null)
    setParsedData(null)
    alert(`Import erfolgreich!\n${stats.fahrzeuge} Fahrzeuge\n${stats.termine} Termine\n${stats.service} Service-Fälligkeiten`)
    onRefresh && onRefresh()
  }

  const fahrzeugeListe = data.map(d => ({ vin: d.vin, kennzeichen: d.kennzeichen }))

  const openInfoModal = async (fahrzeug) => {
    setInfoModal(fahrzeug)
    // Audit-Log laden
    try {
      const res = await fetch(`/api/db/audit-log/${fahrzeug.vin}`)
      const logs = await res.json()
      setAuditLog(logs)
    } catch (err) {
      setAuditLog([])
    }
    // Termine laden
    try {
      const res = await fetch('/api/db/termine')
      const allTermine = await res.json()
      const fahrzeugTermine = allTermine.filter(t => t.vin === fahrzeug.vin)
      setTermine(fahrzeugTermine)
    } catch (err) {
      setTermine([])
    }
  }

  const closeInfoModal = () => {
    setInfoModal(null)
    setAuditLog([])
    setTermine([])
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <CalendarDaysIcon className="w-16 h-16 mx-auto mb-4 stroke-1" />
        <p className="text-sm font-light mb-4">Keine Fälligkeiten in der Datenbank</p>
        <button
          onClick={handleImportToDb}
          disabled={importing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          <CircleStackIcon className="w-4 h-4" />
          {importing ? 'Importiere...' : 'Daten in DB importieren'}
        </button>
        <p className="text-xs text-gray-400 mt-2">Lädt die geparsten PDFs/XLSX in die Datenbank</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Search & Filter Bar */}
      <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
        {/* Search */}
        <div className="flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Suche (Kennzeichen, Name...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
          />
        </div>
        
        {/* Filter: Dringlichkeit */}
        <select
          value={filterUrgency}
          onChange={(e) => setFilterUrgency(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-500"
        >
          <option value="alle">Alle Dringlichkeiten</option>
          <option value="ueberfaellig">Überfällig</option>
          <option value="dringend">Diese Woche</option>
          <option value="normal">Normal</option>
        </select>
        
        {/* Filter: Status */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-gray-500"
        >
          <option value="alle">Alle Status</option>
          <option value="offen">Offen</option>
          <option value="angeschrieben">Angeschrieben</option>
          <option value="termin">Mit Termin</option>
        </select>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Termin
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Termin Formular */}
      {showForm && (
        <div className="py-4 border-b border-gray-100">
          <TerminForm 
            fahrzeuge={fahrzeugeListe} 
            onSave={() => { setShowForm(false); onRefresh && onRefresh(); }}
            onClose={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Table */}
      <div className="mt-4">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200">
              <th className="w-8 pb-3"></th>
              <th className="w-24 pb-3 text-left font-medium text-gray-500">Datum</th>
              <th className="w-36 pb-3 text-left font-medium text-gray-500">Fahrzeug</th>
              <th className="w-28 pb-3 text-left font-medium text-gray-500">Service</th>
              <th className="w-28 pb-3 text-left font-medium text-gray-500">Inspektion</th>
              <th className="w-20 pb-3 text-left font-medium text-gray-500">HU</th>
              <th className="w-10 pb-3 text-center text-gray-400" title="Angeschrieben">
                <EnvelopeIcon className="w-4 h-4 mx-auto" />
              </th>
              <th className="w-28 pb-3 text-center font-medium text-gray-500 text-xs">Termin</th>
              <th className="w-10 pb-3 text-center text-gray-400" title="Nachgefasst">
                <PhoneIcon className="w-4 h-4 mx-auto" />
              </th>
              <th className="w-8 pb-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data
              .filter(f => {
                const status = statusMap[f.vin] || {}
                // Ausgetragen/Wiedervorlage ausfiltern
                if (status.ausgetragen || status.wiedervorlage_datum) return false
                
                // Suche
                if (searchTerm) {
                  const term = searchTerm.toLowerCase()
                  const matchKennzeichen = f.kennzeichen?.toLowerCase().includes(term)
                  const matchKunde = f.kunde?.toLowerCase().includes(term)
                  const matchVin = f.vin?.toLowerCase().includes(term)
                  if (!matchKennzeichen && !matchKunde && !matchVin) return false
                }
                
                // Filter: Dringlichkeit
                if (filterUrgency !== 'alle' && f.urgency !== filterUrgency) return false
                
                // Filter: Status
                if (filterStatus === 'offen' && (status.angeschrieben || status.service_termin)) return false
                if (filterStatus === 'angeschrieben' && !status.angeschrieben) return false
                if (filterStatus === 'termin' && !status.service_termin) return false
                
                return true
              })
              .map((f, i) => {
              const status = statusMap[f.vin] || {}
              const hasTermin = !!status.service_termin
              const hasAngeschrieben = !!status.angeschrieben
              const isOverdue = f.urgency === 'ueberfaellig'
              const isDringend = f.urgency === 'dringend'
              
              // Zeilen-Styling basierend auf Status
              const rowClass = hasTermin 
                ? 'bg-emerald-50/30' 
                : hasAngeschrieben 
                  ? '' 
                  : isOverdue 
                    ? 'bg-red-50/50' 
                    : isDringend 
                      ? 'bg-amber-50/30' 
                      : ''
              
              return (
                <tr 
                  key={f.vin || i} 
                  className={`group hover:bg-gray-50/50 transition-colors ${rowClass}`}
                >
                  {/* Status Icon */}
                  <td className="py-3 pr-2">
                    {hasTermin ? (
                      <CheckCircleSolid className="w-5 h-5 text-emerald-500" />
                    ) : hasAngeschrieben ? (
                      <EnvelopeIcon className="w-5 h-5 text-sky-500" />
                    ) : isOverdue ? (
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                    ) : isDringend ? (
                      <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                    ) : (
                      <ClockIcon className="w-5 h-5 text-gray-300" />
                    )}
                  </td>

                  {/* Datum */}
                  <td className="py-3 pr-4">
                    <span className={`font-medium tabular-nums ${
                      isOverdue ? 'text-red-600' : isDringend ? 'text-amber-600' : 'text-gray-900'
                    }`}>
                      {f.nextDate}
                    </span>
                  </td>

                  {/* Fahrzeug: Kennzeichen + Kunde */}
                  <td className="py-2 pr-4">
                    <button 
                      onClick={() => openInfoModal(f)}
                      className="text-left hover:bg-gray-100 rounded px-1 -mx-1 transition-colors"
                    >
                      <div className="font-medium text-gray-900 flex items-center gap-1">
                        {f.kennzeichen || '–'}
                        <InformationCircleIcon className="w-3.5 h-3.5 text-gray-400" />
                      </div>
                      <div className="text-xs text-gray-500 truncate max-w-[140px]" title={f.kunde}>
                        {f.kunde || '–'}
                      </div>
                    </button>
                  </td>

                  {/* Service fällig */}
                  <td className="py-3 pr-4">
                    {f.serviceFaellig ? (
                      <div>
                        <div className="text-gray-900 tabular-nums">{f.serviceFaellig}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[140px]" title={f.serviceBezeichnung}>
                          {f.serviceBezeichnung}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-300">–</span>
                    )}
                  </td>

                  {/* Inspektion */}
                  <td className="py-3 pr-4">
                    {f.inspektionTermin ? (
                      <div>
                        <span className="text-gray-900 tabular-nums">{f.inspektionTermin}</span>
                        {f.inspektionVermerk && (
                          <div className="text-xs text-gray-400 truncate max-w-[120px]" title={f.inspektionVermerk}>
                            {f.inspektionVermerk}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-300">–</span>
                    )}
                  </td>

                  {/* HU */}
                  <td className="py-3 pr-4">
                    <span className={f.huTermin ? 'text-gray-900 tabular-nums' : 'text-gray-300'}>
                      {f.huTermin || '–'}
                    </span>
                  </td>

                  {/* Mail */}
                  <td className="py-2 text-center">
                    <button
                      onClick={() => handleStatusChange(f.vin, 'angeschrieben', !statusMap[f.vin]?.angeschrieben)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors mx-auto ${
                        statusMap[f.vin]?.angeschrieben 
                          ? 'bg-gray-800' 
                          : 'border-2 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {statusMap[f.vin]?.angeschrieben && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  </td>

                  {/* Termin */}
                  <td className="py-2 px-1">
                    <input
                      type="date"
                      value={statusMap[f.vin]?.service_termin || ''}
                      onChange={(e) => handleStatusChange(f.vin, 'service_termin', e.target.value)}
                      className="w-full px-1 py-1 text-xs rounded border border-gray-300 hover:border-gray-400 transition-colors cursor-pointer"
                    />
                  </td>

                  {/* Telefon - nur sichtbar wenn: angeschrieben + kein Termin + >7 Tage überfällig */}
                  <td className="py-2 text-center">
                    {(() => {
                      const showPhone = hasAngeschrieben && !hasTermin && isOverdue;
                      if (!showPhone) return null;
                      
                      return (
                        <button
                          onClick={() => handleStatusChange(f.vin, 'nachgefasst', !statusMap[f.vin]?.nachgefasst)}
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors mx-auto ${
                            statusMap[f.vin]?.nachgefasst 
                              ? 'bg-gray-800' 
                              : 'border-2 border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {statusMap[f.vin]?.nachgefasst && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })()}
                  </td>

                  {/* Kontextmenü */}
                  <td className="py-2 text-center relative">
                    <button
                      onClick={() => setOpenMenu(openMenu === f.vin ? null : f.vin)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <EllipsisVerticalIcon className="w-4 h-4 text-gray-400" />
                    </button>
                    {openMenu === f.vin && (
                      <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[140px]">
                        <button
                          onClick={() => { setModal({ type: 'austragen', vin: f.vin }); setOpenMenu(null); }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <TrashIcon className="w-4 h-4 text-gray-400" />
                          Austragen
                        </button>
                        <button
                          onClick={() => { setModal({ type: 'wiedervorlage', vin: f.vin }); setOpenMenu(null); }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <ArrowPathIcon className="w-4 h-4 text-gray-400" />
                          Wiedervorlage
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Legend */}
      <div className="flex items-center gap-6 pt-4 mt-4 border-t border-gray-100 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <CheckCircleSolid className="w-4 h-4 text-emerald-500" />
          <span>Termin</span>
        </div>
        <div className="flex items-center gap-1.5">
          <EnvelopeIcon className="w-4 h-4 text-sky-500" />
          <span>Angeschrieben</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
          <span>Überfällig</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
          <span>Diese Woche</span>
        </div>
        <div className="ml-auto text-gray-400">{data.length} Einträge</div>
      </div>

      {/* Modal: Austragen */}
      {modal.type === 'austragen' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal({ type: null, vin: null })}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Fahrzeug austragen</h3>
              <button onClick={() => setModal({ type: null, vin: null })} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Grund</label>
              <textarea
                value={modalData.grund}
                onChange={(e) => setModalData(prev => ({ ...prev, grund: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                rows={3}
                placeholder="Grund für das Austragen..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModal({ type: null, vin: null })}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAustragen}
                disabled={!modalData.grund}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Austragen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Wiedervorlage */}
      {modal.type === 'wiedervorlage' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal({ type: null, vin: null })}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Wiedervorlage</h3>
              <button onClick={() => setModal({ type: null, vin: null })} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
              <input
                type="date"
                value={modalData.datum}
                onChange={(e) => setModalData(prev => ({ ...prev, datum: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Grund</label>
              <textarea
                value={modalData.grund}
                onChange={(e) => setModalData(prev => ({ ...prev, grund: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                rows={3}
                placeholder="Grund für Wiedervorlage..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModal({ type: null, vin: null })}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Abbrechen
              </button>
              <button
                onClick={handleWiedervorlage}
                disabled={!modalData.grund || !modalData.datum}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Fahrzeug-Info */}
      {infoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeInfoModal}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{infoModal.kennzeichen}</h3>
                <p className="text-sm text-gray-500">{infoModal.kunde || 'Kein Kunde'}</p>
              </div>
              <button onClick={closeInfoModal} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[calc(85vh-80px)]">
              {/* Fahrzeug-Daten */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Fahrzeug-Daten</h4>
                <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">VIN:</span>
                    <span className="ml-2 font-mono text-xs">{infoModal.vin}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Kennzeichen:</span>
                    <span className="ml-2 font-medium">{infoModal.kennzeichen}</span>
                  </div>
                </div>
              </div>

              {/* Aktuelle Fälligkeiten */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Fälligkeiten</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Service:</span>
                    <span className="font-medium">{infoModal.serviceFaellig || '–'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Inspektion:</span>
                    <span className="font-medium">{infoModal.inspektionTermin || '–'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">HU:</span>
                    <span className="font-medium">{infoModal.huTermin || '–'}</span>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Aktueller Status</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Angeschrieben:</span>
                    <span className={statusMap[infoModal.vin]?.angeschrieben ? 'text-green-600' : 'text-gray-400'}>
                      {statusMap[infoModal.vin]?.angeschrieben ? 'Ja' : 'Nein'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Service-Termin:</span>
                    <span className="font-medium">{statusMap[infoModal.vin]?.service_termin || '–'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nachgefasst:</span>
                    <span className={statusMap[infoModal.vin]?.nachgefasst ? 'text-green-600' : 'text-gray-400'}>
                      {statusMap[infoModal.vin]?.nachgefasst ? 'Ja' : 'Nein'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Termine Historie */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Termine Historie ({termine.length})</h4>
                {termine.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Keine Termine gefunden</p>
                ) : (
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-600">Datum</th>
                          <th className="px-3 py-2 text-left text-gray-600">Typ</th>
                          <th className="px-3 py-2 text-left text-gray-600">Vermerk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {termine.map((t, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2">{t.datum}</td>
                            <td className="px-3 py-2 capitalize">{t.typ}</td>
                            <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]">{t.vermerk || '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Audit-Log */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Änderungs-Historie ({auditLog.length})</h4>
                {auditLog.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">Keine Änderungen protokolliert</p>
                ) : (
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-600">Datum</th>
                          <th className="px-3 py-2 text-left text-gray-600">User</th>
                          <th className="px-3 py-2 text-left text-gray-600">Aktion</th>
                          <th className="px-3 py-2 text-left text-gray-600">Änderung</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {auditLog.map((log, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-xs text-gray-500">
                              {new Date(log.created_at).toLocaleString('de-DE')}
                            </td>
                            <td className="px-3 py-2 font-medium">{log.user_name}</td>
                            <td className="px-3 py-2">{log.aktion}</td>
                            <td className="px-3 py-2 text-gray-500">
                              {log.feld}: {log.alter_wert} → {log.neuer_wert}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Merge Dialog */}
      {importPreview && parsedData && (
        <ImportMergeDialog
          preview={importPreview}
          parsedData={parsedData}
          onClose={() => { setImportPreview(null); setParsedData(null); }}
          onImport={handleImportComplete}
        />
      )}
    </div>
  )
}
