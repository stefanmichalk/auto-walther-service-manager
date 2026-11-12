import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon, ChevronRightIcon, ChevronLeftIcon } from '../icons'

export function FahrzeugeListe({ token, globalSearch }) {
  const [fahrzeuge, setFahrzeuge] = useState([])
  const [searchTerm, setSearchTerm] = useState(globalSearch || '')
  useEffect(() => { if (globalSearch !== undefined) setSearchTerm(globalSearch) }, [globalSearch])
  const [selectedFahrzeug, setSelectedFahrzeug] = useState(null)
  const [historie, setHistorie] = useState([])
  const [statusByVin, setStatusByVin] = useState({})

  useEffect(() => {
    if (!token) return
    fetch('/api/db/fahrzeuge', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setFahrzeuge(data))
      .catch(err => console.error('Fehler beim Laden:', err))
    fetch('/api/db/fahrzeug-status', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(list => setStatusByVin(Object.fromEntries((list || []).map(s => [s.vin, s]))))
      .catch(() => {})
  }, [token])

  // Kurzer Status als Tag für die Liste
  const statusTag = (vin) => {
    const st = statusByVin[vin]
    if (!st) return { text: 'offen', dot: 'bg-gray-400' }
    if (st.ausgetragen) return { text: 'ausgetragen', dot: 'bg-red-600' }
    if (st.wiedervorlage_datum) return { text: 'wiedervorlage', dot: 'bg-amber-500' }
    if (st.service_termin) return { text: 'termin', dot: 'bg-brand-500' }
    if (st.angeschrieben) return { text: 'angeschrieben', dot: 'bg-sky-500' }
    return { text: 'offen', dot: 'bg-gray-400' }
  }

  const loadHistorie = async (vin) => {
    try {
      const [termineRes, auditRes, statusRes] = await Promise.all([
        fetch(`/api/db/termine?vin=${vin}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/db/audit-log/${vin}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/db/fahrzeug-status/${vin}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])
      const termine = await termineRes.json()
      const audit = await auditRes.json()
      const status = statusRes.ok ? await statusRes.json() : null
      setHistorie({ termine, audit, status })
    } catch (err) {
      setHistorie({ termine: [], audit: [], status: null })
    }
  }

  const handleSelect = (fahrzeug) => {
    setSelectedFahrzeug(fahrzeug)
    loadHistorie(fahrzeug.vin)
  }

  const filtered = fahrzeuge.filter(f => 
    f.kennzeichen?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.kunde_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.vin?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (d) => {
    if (!d) return '-'
    if (d.includes('.')) return d
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="flex gap-6 h-full min-h-0">
      {/* Liste */}
      <div className={`${selectedFahrzeug ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col h-full flex-shrink-0`}>
        {/* Suche */}
        <div className="relative mb-4 flex-shrink-0 hidden md:block">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Suche..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="field w-full pl-9 pr-4"
          />
        </div>

        {/* Fahrzeug-Liste */}
        <div className="flex-1 overflow-y-auto bg-white border border-slate-200 min-h-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Keine Fahrzeuge
            </div>
          ) : (
            filtered.map(f => (
              <button
                key={f.vin}
                onClick={() => handleSelect(f)}
                className={`w-full px-4 py-3 text-left border-b border-slate-100 flex items-center justify-between transition-colors ${
                  selectedFahrzeug?.vin === f.vin ? 'bg-slate-50' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="font-medium text-slate-900 text-sm">{f.kennzeichen || f.vin}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{f.kunde_name || '-'}</div>
                </div>
                <span className="ml-auto mr-2 inline-flex items-center gap-1.5 text-xs text-slate-700">
                  <span className={`w-2 h-2 rounded-full ${statusTag(f.vin).dot}`} />
                  {statusTag(f.vin).text}
                </span>
                <ChevronRightIcon className="w-4 h-4 text-slate-300" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail-Ansicht */}
      {selectedFahrzeug ? (
        <div className="flex-1 min-w-0 bg-white border border-slate-200 flex flex-col overflow-y-auto md:overflow-hidden">
          {/* Header */}
          <div className="px-4 md:px-6 py-4 border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setSelectedFahrzeug(null)}
              className="md:hidden w-9 h-9 -ml-1 grid place-items-center rounded-full hover:bg-slate-100 text-slate-900"
              aria-label="Zurück zur Liste"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-light text-slate-900">{selectedFahrzeug.kennzeichen}</h3>
              <p className="text-sm text-slate-500">{selectedFahrzeug.kunde_name || '-'}</p>
            </div>
            <button 
              onClick={() => setSelectedFahrzeug(null)}
              className="hidden md:inline text-sm text-slate-900 underline underline-offset-4 hover:text-brand-700"
            >
              Schließen
            </button>
          </div>

          {/* Fahrzeug-Info */}
          <div className="px-4 md:px-6 py-4 border-b border-slate-200 flex-shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">VIN</span>
                <span className="font-mono text-xs text-slate-900">{selectedFahrzeug.vin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hersteller</span>
                <span className="text-slate-900">{selectedFahrzeug.hersteller || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Modell</span>
                <span className="text-slate-900">{selectedFahrzeug.modell || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Erstzulassung</span>
                <span className="text-slate-900">{selectedFahrzeug.erstzulassung || '-'}</span>
              </div>
            </div>
          </div>

          {/* Aktueller Bearbeitungsstatus */}
          <div className="px-4 md:px-6 py-4 border-b border-slate-200 flex-shrink-0">
            <h4 className="eyebrow mb-3">Status</h4>
            {(() => {
              const st = historie.status
              if (!st) return <p className="text-sm text-slate-400">Noch nicht bearbeitet (offen)</p>
              const rows = [
                ['Angeschrieben', st.angeschrieben ? 'ja' : 'nein'],
                ['Termin', st.service_termin ? formatDate(st.service_termin) : '-'],
                ['Nachgefasst', st.nachgefasst ? 'ja' : 'nein'],
              ]
              if (st.ausgetragen) rows.push(['Ausgetragen', st.austragen_grund ? `ja – ${st.austragen_grund}` : 'ja (kein Grund gespeichert)'])
              if (st.wiedervorlage_datum) rows.push(['Wiedervorlage', `${formatDate(st.wiedervorlage_datum)}${st.wiedervorlage_grund ? ` – ${st.wiedervorlage_grund}` : ''}`])
              if (st.notiz) rows.push(['Notiz', st.notiz])
              return (
                <>
                  {st.ausgetragen ? (
                    <div className="mb-3 px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-100">
                      Ausgetragen{st.austragen_grund ? `: ${st.austragen_grund}` : ''} – steht im Archiv
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-8 text-sm">
                    {rows.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-900 text-right">{v}</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            })()}
          </div>

          {/* Termine / Historie */}
          <div className="md:flex-1 md:overflow-y-auto px-4 md:px-6 py-4">
            <h4 className="eyebrow mb-3">Termine</h4>
            
            {historie.termine?.length > 0 ? (
              <div className="space-y-2 mb-6">
                {historie.termine.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-slate-50">
                    <span className="inline-flex items-center gap-1.5 w-28 flex-shrink-0 px-2 py-0.5 border border-slate-300 text-[10.5px] font-medium uppercase tracking-[0.1em] text-slate-900">
                      <span className={`w-1.5 h-1.5 rounded-full ${t.typ === 'hu' ? 'bg-amber-500' : t.typ === 'inspektion' ? 'bg-brand-500' : 'bg-sky-500'}`} />
                      {t.typ === 'hu' ? 'HU' : t.typ}
                    </span>
                    <span className="tabular-nums text-slate-900">{formatDate(t.datum)}</span>
                    <span className="text-slate-500">{t.bezeichnung}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 mb-6">Keine Termine</p>
            )}

            {historie.audit?.length > 0 && (
              <>
                <h4 className="eyebrow mb-3 mt-6">Aktivitäten</h4>
                <ol className="relative border-l border-slate-200 ml-1">
                  {historie.audit.slice(0, 20).map((a, i) => (
                    <li key={i} className="pl-4 pb-4 last:pb-0 relative">
                      <span className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full bg-slate-400" />
                      <div className="text-sm text-slate-900">
                        {a.aktion}
                        {a.feld && <span className="text-slate-600"> · {a.alter_wert} → {a.neuer_wert}</span>}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                        {formatDate(a.created_at)}{a.user_name ? ` · ${a.user_name}` : ''}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-white border border-slate-200">
          <p className="text-slate-500 text-sm">Wähle links ein Fahrzeug, um Status, Termine und Verlauf zu sehen.</p>
        </div>
      )}
    </div>
  )
}
