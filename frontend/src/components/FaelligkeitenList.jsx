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
  InformationCircleIcon,
  ChartBarIcon,
  UserIcon,
  TruckIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'
import { TerminForm } from './TerminForm'
import { ImportMergeDialog } from './ImportMergeDialog'

export function FaelligkeitenList({ data, onRefresh, currentUser, token }) {
  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
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
  const [buchungsLink, setBuchungsLink] = useState(null)

  // Lade gespeicherte Status beim Mount
  useEffect(() => {
    if (!token) return
    fetch('/api/db/fahrzeug-status', { headers: { 'Authorization': `Bearer ${token}` } })
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
      // Bei "Angeschrieben" = true: Buchungs-Token generieren
      if (field === 'angeschrieben' && value === true) {
        const fahrzeug = data.find(f => f.vin === vin)
        if (fahrzeug?.fahrzeug_id) {
          const res = await fetch('/api/buchung/token/generieren', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fahrzeug_id: fahrzeug.fahrzeug_id, typ: 'service' })
          })
          if (res.ok) {
            const { token } = await res.json()
            setBuchungsLink({ vin, code: token, kennzeichen: fahrzeug.kennzeichen })
          }
        }
      }
      
      // Termin-Änderungen in geplante_termine speichern
      if (field === 'service_termin') {
        const fahrzeug = data.find(f => f.vin === vin)
        if (fahrzeug?.fahrzeug_id && value) {
          await fetch('/api/db/geplante-termine', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fahrzeug_id: fahrzeug.fahrzeug_id, typ: 'service', datum: value })
          })
        }
      }
      
      // Auch in fahrzeug_status speichern (für Angeschrieben etc.)
      await fetch('/api/db/fahrzeug-status', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
      const dataRes = await fetch('/api/data', { headers: { 'Authorization': `Bearer ${token}` } })
      const parsed = await dataRes.json()
      setParsedData(parsed)
      
      // Dann Vorschau erstellen
      const previewRes = await fetch('/api/db/import-preview', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed)
      })
      const previewJson = await previewRes.json()
      
      if (previewJson.success) {
        // Wenn alles neu ist, direkt importieren
        if (previewJson.summary.aktualisiert === 0 && previewJson.summary.unveraendert === 0) {
          // Direkter Import
          const importRes = await fetch('/api/db/import-current', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } })
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
      const res = await fetch(`/api/db/audit-log/${fahrzeug.vin}`, { headers: { 'Authorization': `Bearer ${token}` } })
      const logs = await res.json()
      setAuditLog(logs)
    } catch (err) {
      setAuditLog([])
    }
    // Termine laden
    try {
      const res = await fetch('/api/db/termine', { headers: { 'Authorization': `Bearer ${token}` } })
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
    const handleDrop = async (e) => {
      e.preventDefault()
      e.stopPropagation()
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0 && onRefresh) {
        // Trigger upload via parent
        window.dispatchEvent(new CustomEvent('dropzone-files', { detail: files }))
      }
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div 
          className="bg-white shadow-lg rounded-2xl border-2 border-dashed border-gray-200 hover:border-emerald-400 p-12 max-w-md text-center cursor-pointer transition-colors"
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-emerald-500', 'bg-emerald-50') }}
          onDragLeave={(e) => { e.currentTarget.classList.remove('border-emerald-500', 'bg-emerald-50') }}
          onDrop={handleDrop}
          onClick={() => document.getElementById('empty-file-input')?.click()}
        >
          <input 
            type="file" 
            id="empty-file-input"
            className="hidden" 
            multiple 
            accept=".pdf,.xlsx,.xls"
            onChange={(e) => {
              const files = Array.from(e.target.files || [])
              if (files.length > 0) {
                window.dispatchEvent(new CustomEvent('dropzone-files', { detail: files }))
              }
            }}
          />
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ArrowDownTrayIcon className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Keine Fälligkeiten</h2>
          <p className="text-sm text-gray-500 mb-4">
            Dateien hier ablegen oder klicken zum Auswählen
          </p>
          <p className="text-xs text-gray-400">
            PDF (HU, Inspektion) • XLSX (Service-Fälligkeiten)
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6 flex-shrink-0">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Gesamt</p>
          <p className="text-2xl font-bold text-gray-900">{data.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Überfällig</p>
          <p className="text-2xl font-bold text-red-600">{data.filter(f => f.urgency === 'ueberfaellig').length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Diese Woche</p>
          <p className="text-2xl font-bold text-amber-600">{data.filter(f => f.urgency === 'dringend').length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Mit Termin</p>
          <p className="text-2xl font-bold text-emerald-600">{Object.values(statusMap).filter(s => s.service_termin).length}</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <input
            type="text"
            placeholder="Suche..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 px-4 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all rounded-xl"
          />
          
          <select
            value={filterUrgency}
            onChange={(e) => setFilterUrgency(e.target.value)}
            className="px-4 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-emerald-500 outline-none rounded-xl"
          >
            <option value="alle">Alle</option>
            <option value="ueberfaellig">Überfällig</option>
            <option value="dringend">Dringend</option>
            <option value="normal">Normal</option>
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 text-sm bg-gray-50 border border-gray-200 focus:border-emerald-500 outline-none rounded-xl"
          >
            <option value="alle">Alle Status</option>
            <option value="offen">Offen</option>
            <option value="angeschrieben">Angeschrieben</option>
            <option value="termin">Mit Termin</option>
          </select>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Termin
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

      {/* Termin Formular */}
      {showForm && (
        <div className="py-4 border-b border-slate-200 flex-shrink-0">
          <TerminForm 
            fahrzeuge={fahrzeugeListe} 
            onSave={() => { setShowForm(false); onRefresh && onRefresh(); }}
            onClose={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Mobile Cards / Desktop Table */}
      <div className="mt-4 flex-1 overflow-y-auto min-h-0">
        {/* Mobile: Card View */}
        <div className="md:hidden space-y-2">
          {data
            .filter(f => {
              const status = statusMap[f.vin] || {}
              if (status.ausgetragen || status.wiedervorlage_datum) return false
              if (searchTerm) {
                const term = searchTerm.toLowerCase()
                if (!f.kennzeichen?.toLowerCase().includes(term) && !f.kunde?.toLowerCase().includes(term)) return false
              }
              if (filterUrgency !== 'alle' && f.urgency !== filterUrgency) return false
              if (filterStatus === 'offen' && (status.angeschrieben || status.service_termin)) return false
              if (filterStatus === 'angeschrieben' && !status.angeschrieben) return false
              if (filterStatus === 'termin' && !status.service_termin) return false
              return true
            })
            .sort((a, b) => {
              const parseDate = (dateStr) => {
                if (!dateStr) return new Date(9999, 11, 31)
                if (dateStr.includes('.')) {
                  const [d, m, y] = dateStr.split('.')
                  return new Date(y, m - 1, d)
                }
                return new Date(dateStr)
              }
              return parseDate(a.nextDate) - parseDate(b.nextDate)
            })
            .map((f, i) => {
              const status = statusMap[f.vin] || {}
              const hasTermin = !!status.service_termin
              const hasAngeschrieben = !!status.angeschrieben
              const isOverdue = f.urgency === 'ueberfaellig'
              const isDringend = f.urgency === 'dringend'
              
              return (
                <div 
                  key={f.vin || i}
                  onClick={() => openInfoModal(f)}
                  className={`p-3 rounded-lg border cursor-pointer active:scale-[0.99] transition-all ${
                    hasTermin ? 'bg-emerald-50 border-emerald-200' :
                    isOverdue ? 'bg-red-50 border-red-200' :
                    isDringend ? 'bg-amber-50 border-amber-200' :
                    'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {hasTermin ? (
                        <CheckCircleSolid className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      ) : isOverdue ? (
                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                      ) : isDringend ? (
                        <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      ) : (
                        <ClockIcon className="w-5 h-5 text-gray-300 flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-semibold text-gray-900">{f.kennzeichen}</div>
                        <div className="text-xs text-gray-500">{f.kunde || '–'}</div>
                      </div>
                    </div>
                    <div className={`text-sm font-medium tabular-nums ${
                      isOverdue ? 'text-red-600' : isDringend ? 'text-amber-600' : 'text-gray-700'
                    }`}>
                      {f.nextDate}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 text-xs">
                    {hasAngeschrieben && <span className="text-sky-600">✓ Angeschrieben</span>}
                    {hasTermin && <span className="text-emerald-600">Termin: {status.service_termin}</span>}
                    {!hasAngeschrieben && !hasTermin && <span className="text-gray-400">Noch offen</span>}
                  </div>
                </div>
              )
            })}
        </div>

        {/* Desktop: Table View */}
        <table className="hidden md:table w-full text-sm">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b border-gray-200">
              <th className="w-8 pb-3 pl-4"></th>
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
              .sort((a, b) => {
                // Nach Datum aufsteigend sortieren
                const parseDate = (dateStr) => {
                  if (!dateStr) return new Date(9999, 11, 31)
                  if (dateStr.includes('.')) {
                    const [d, m, y] = dateStr.split('.')
                    return new Date(y, m - 1, d)
                  }
                  return new Date(dateStr)
                }
                return parseDate(a.nextDate) - parseDate(b.nextDate)
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
                  <td className="py-3 pl-4 pr-2">
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

      {/* Modal: Fahrzeug-Detail - Umfangreich mit Sidebar */}
      {infoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeInfoModal}>
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex" onClick={e => e.stopPropagation()}>
            {/* Sidebar */}
            <div className="w-56 bg-gray-50 border-r border-gray-200 flex flex-col flex-shrink-0">
              {/* Header */}
              <div className="p-5 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">{infoModal.kennzeichen}</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">{infoModal.vin}</p>
              </div>
              
              {/* Navigation */}
              <nav className="flex-1 p-3">
                {[
                  { id: 'uebersicht', label: 'Übersicht', Icon: ChartBarIcon },
                  { id: 'kunde', label: 'Kundendaten', Icon: UserIcon },
                  { id: 'fahrzeug', label: 'Fahrzeug', Icon: TruckIcon },
                  { id: 'historie', label: 'Historie', Icon: CalendarDaysIcon },
                  { id: 'audit', label: 'Audit-Log', Icon: ClipboardDocumentListIcon },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setInfoModal({ ...infoModal, activeTab: tab.id })}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left transition-all ${
                      (infoModal.activeTab || 'uebersicht') === tab.id
                        ? 'bg-emerald-100 text-emerald-800 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <tab.Icon className={`w-5 h-5 ${(infoModal.activeTab || 'uebersicht') === tab.id ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <span className="text-sm">{tab.label}</span>
                  </button>
                ))}
              </nav>
              
              {/* Status Quick View */}
              <div className="p-4 border-t border-gray-200">
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Status</span>
                    <span className={`px-2 py-0.5 rounded-full ${
                      statusMap[infoModal.vin]?.service_termin 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : statusMap[infoModal.vin]?.angeschrieben 
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      {statusMap[infoModal.vin]?.service_termin ? 'Termin' : statusMap[infoModal.vin]?.angeschrieben ? 'Angeschrieben' : 'Offen'}
                    </span>
                  </div>
                  {infoModal.nextDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Nächste Fälligkeit</span>
                      <span className="font-medium text-gray-900">{infoModal.nextDate}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {(infoModal.activeTab || 'uebersicht') === 'uebersicht' && 'Übersicht'}
                  {infoModal.activeTab === 'kunde' && 'Kundendaten'}
                  {infoModal.activeTab === 'fahrzeug' && 'Fahrzeug'}
                  {infoModal.activeTab === 'historie' && 'Historie'}
                  {infoModal.activeTab === 'audit' && 'Audit-Log'}
                </h2>
                <button onClick={closeInfoModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Tab: Übersicht */}
                {(infoModal.activeTab || 'uebersicht') === 'uebersicht' && (
                  <div className="space-y-6">
                    {/* Fälligkeiten Cards */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Fälligkeiten</h4>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs text-gray-500 mb-1">Service</p>
                          <p className="text-lg font-bold text-gray-900">{infoModal.serviceFaellig || '–'}</p>
                          {infoModal.serviceBezeichnung && <p className="text-xs text-gray-500 mt-1">{infoModal.serviceBezeichnung}</p>}
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs text-gray-500 mb-1">Inspektion</p>
                          <p className="text-lg font-bold text-gray-900">{infoModal.inspektionTermin || '–'}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs text-gray-500 mb-1">HU</p>
                          <p className="text-lg font-bold text-gray-900">{infoModal.huTermin || '–'}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Status */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Bearbeitungsstatus</h4>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                          <input 
                            type="checkbox" 
                            checked={statusMap[infoModal.vin]?.angeschrieben || false}
                            onChange={(e) => handleStatusChange(infoModal.vin, 'angeschrieben', e.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-gray-700">Angeschrieben</span>
                        </label>
                        <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100">
                          <input 
                            type="checkbox" 
                            checked={statusMap[infoModal.vin]?.nachgefasst || false}
                            onChange={(e) => handleStatusChange(infoModal.vin, 'nachgefasst', e.target.checked)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-gray-700">Nachgefasst</span>
                        </label>
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl">
                          <span className="text-sm text-gray-700">Termin:</span>
                          <input 
                            type="date"
                            value={statusMap[infoModal.vin]?.service_termin || ''}
                            onChange={(e) => handleStatusChange(infoModal.vin, 'service_termin', e.target.value)}
                            className="text-sm border-0 bg-transparent focus:ring-0 p-0"
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Kunde Quick Info */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Kunde</h4>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="font-medium text-gray-900">{infoModal.kunde || 'Kein Kunde hinterlegt'}</p>
                        {(infoModal.kundeStrasse || infoModal.kundePlz || infoModal.kundeOrt) && (
                          <p className="text-sm text-gray-500 mt-1">
                            {infoModal.kundeStrasse}{infoModal.kundeStrasse && ', '}{infoModal.kundePlz} {infoModal.kundeOrt}
                          </p>
                        )}
                        {infoModal.kundeTelefon && <p className="text-sm text-gray-500">Tel: {infoModal.kundeTelefon}</p>}
                        {infoModal.kundeEmail && <p className="text-sm text-gray-500">{infoModal.kundeEmail}</p>}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Tab: Kundendaten */}
                {infoModal.activeTab === 'kunde' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input 
                          type="text" 
                          defaultValue={infoModal.kunde || ''} 
                          placeholder="Name eingeben..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                        <input 
                          type="tel" 
                          defaultValue={infoModal.kundeTelefon || ''} 
                          placeholder="Telefon..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Straße</label>
                        <input 
                          type="text" 
                          defaultValue={infoModal.kundeStrasse || ''} 
                          placeholder="Straße..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">PLZ / Ort</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            defaultValue={infoModal.kundePlz || ''} 
                            placeholder="PLZ"
                            className="w-24 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                          <input 
                            type="text" 
                            defaultValue={infoModal.kundeOrt || ''} 
                            placeholder="Ort"
                            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">E-Mail</label>
                        <input 
                          type="email" 
                          defaultValue={infoModal.kundeEmail || ''} 
                          placeholder="E-Mail..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Notizen</label>
                      <textarea 
                        rows={4}
                        defaultValue=""
                        placeholder="Notizen zum Kunden..."
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                      />
                    </div>
                    
                    <div className="flex justify-end">
                      <button className="px-6 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
                        Speichern
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Tab: Fahrzeug */}
                {infoModal.activeTab === 'fahrzeug' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500 mb-1">Kennzeichen</p>
                        <p className="text-lg font-bold text-gray-900">{infoModal.kennzeichen}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500 mb-1">Fahrgestellnummer</p>
                        <p className="text-sm font-mono text-gray-900">{infoModal.vin}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500 mb-1">Hersteller</p>
                        <p className="text-lg font-bold text-gray-900">{infoModal.hersteller || '–'}</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs text-gray-500 mb-1">Modell</p>
                        <p className="text-lg font-bold text-gray-900">{infoModal.modell || '–'}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Tab: Historie */}
                {infoModal.activeTab === 'historie' && (
                  <div>
                    {termine.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <p>Keine Historie vorhanden</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {termine.map((t, i) => (
                          <div key={`t-${i}`} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                            <div className="w-24 text-sm font-medium text-gray-900 tabular-nums">{t.datum}</div>
                            <div className="px-3 py-1 bg-gray-200 rounded-lg text-xs font-medium text-gray-700 uppercase">{t.typ}</div>
                            <div className="flex-1 text-sm text-gray-600">{t.vermerk || '–'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Tab: Audit-Log */}
                {infoModal.activeTab === 'audit' && (
                  <div>
                    {auditLog.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <p>Keine Aktivitäten protokolliert</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {auditLog.map((log, i) => (
                          <div key={`log-${i}`} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                            <div className="w-32 text-xs text-gray-500 tabular-nums">{new Date(log.created_at).toLocaleString('de-DE')}</div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{log.aktion}</p>
                              {log.feld && <p className="text-xs text-gray-500 mt-1">{log.feld}: {log.alter_wert} → {log.neuer_wert}</p>}
                            </div>
                            <div className="text-xs text-gray-400">{log.user_name}</div>
                          </div>
                        ))}
                      </div>
                    )}
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
          token={token}
        />
      )}

      {/* Buchungscode Modal */}
      {buchungsLink && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setBuchungsLink(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Buchungscode erstellt</h3>
            <p className="text-sm text-gray-500 mb-4">
              Für <span className="font-medium">{buchungsLink.kennzeichen}</span> wurde ein Buchungscode erstellt.
            </p>
            
            <div className="bg-emerald-50 rounded-xl p-6 mb-4 text-center">
              <p className="text-xs text-gray-500 mb-2">Buchungscode</p>
              <p className="text-4xl font-bold tracking-widest text-emerald-700">{buchungsLink.code}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-600">
              <p className="font-medium mb-1">Für den Serienbrief:</p>
              <p>Code: <span className="font-mono font-bold">{buchungsLink.code}</span></p>
              <p>Kennzeichen: <span className="font-medium">{buchungsLink.kennzeichen}</span></p>
              <p>URL: <span className="text-emerald-600">{window.location.origin}/buchen</span></p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(buchungsLink.code)
                  setBuchungsLink(null)
                }}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
              >
                Code kopieren
              </button>
              <button
                onClick={() => setBuchungsLink(null)}
                className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
              >
                Schließen
              </button>
            </div>
            
            <p className="text-xs text-gray-400 mt-3">
              Der Code ist 30 Tage gültig.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
