import { useState, useEffect } from 'react'
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  PlusCircleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon,
  XMarkIcon
} from '../icons'
import { FahrzeugModal } from './FahrzeugModal'

// Montag = erster Tag der Woche
const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

export function AuslastungView({ token }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [auslastung, setAuslastung] = useState({ tage: {}, kapazitaeten: {}, ausnahmen: {} })
  const [loading, setLoading] = useState(true)
  const [selectedFahrzeugId, setSelectedFahrzeugId] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [editKapazitaet, setEditKapazitaet] = useState(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    loadAuslastung()
  }, [year, month])

  const loadAuslastung = async () => {
    setLoading(true)
    const von = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const bis = `${year}-${String(month + 1).padStart(2, '0')}-31`
    
    try {
      const res = await fetch(`/api/db/auslastung?von=${von}&bis=${bis}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setAuslastung(data)
    } catch (err) {
      console.error('Auslastung laden fehlgeschlagen:', err)
    }
    setLoading(false)
  }

  // Fahrzeug-Suche
  const handleSearch = async (q) => {
    setSearchQuery(q)
    if (q.length < 2) {
      setSearchResults([])
      return
    }
    try {
      const res = await fetch(`/api/db/fahrzeuge-suche?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setSearchResults(await res.json())
    } catch (err) {
      console.error('Suche fehlgeschlagen:', err)
    }
  }

  // Fahrzeug zu Tag hinzufügen
  const handleAddFahrzeug = async (fahrzeugId) => {
    if (!selectedDay) return
    try {
      await fetch('/api/db/geplante-termine', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fahrzeug_id: fahrzeugId, typ: 'service', datum: selectedDay.date })
      })
      setSearchQuery('')
      setSearchResults([])
      loadAuslastung()
      // Update selectedDay
      const newItems = [...(selectedDay.items || []), searchResults.find(r => r.id === fahrzeugId)]
      setSelectedDay({ ...selectedDay, items: newItems })
    } catch (err) {
      console.error('Hinzufügen fehlgeschlagen:', err)
    }
  }

  // Kapazität für Tag ändern
  const handleSaveKapazitaet = async () => {
    if (!selectedDay || editKapazitaet === null) return
    try {
      await fetch('/api/db/kapazitaet-ausnahme', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ datum: selectedDay.date, max_termine: editKapazitaet })
      })
      loadAuslastung()
      setSelectedDay({ ...selectedDay, maxTermine: editKapazitaet })
    } catch (err) {
      console.error('Kapazität speichern fehlgeschlagen:', err)
    }
  }

  // Kalender-Tage generieren (Montag = erster Tag)
  const generateCalendarDays = () => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    // Montag = 0, Sonntag = 6
    let startPadding = firstDay.getDay() - 1
    if (startPadding < 0) startPadding = 6
    const days = []

    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d)
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const jsWochentag = date.getDay()
      const kapazitaet = auslastung.kapazitaeten[jsWochentag]
      const ausnahme = auslastung.ausnahmen?.[dateStr]
      const tagesData = auslastung.tage[dateStr] || { items: [] }
      const items = tagesData.items || []
      // Ausnahme hat Vorrang vor Standard-Kapazität
      const maxTermine = ausnahme ? ausnahme.max_termine : (kapazitaet?.aktiv ? kapazitaet.max_termine : 0)
      const aktiv = ausnahme ? ausnahme.max_termine > 0 : kapazitaet?.aktiv
      
      days.push({
        day: d,
        date: dateStr,
        jsWochentag,
        items,
        maxTermine,
        aktiv,
        hasAusnahme: !!ausnahme,
        auslastung: maxTermine > 0 ? Math.round((items.length / maxTermine) * 100) : 0,
        isToday: new Date().toDateString() === date.toDateString()
      })
    }

    return days
  }

  const days = generateCalendarDays()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const getAuslastungColor = (day) => {
    if (!day || !day.aktiv) return 'bg-gray-100'
    const frei = day.maxTermine - day.items.length
    if (day.items.length >= day.maxTermine) return 'bg-red-200'  // voll
    if (frei <= 1 || day.auslastung >= 75) return 'bg-amber-200' // nur noch 1 frei oder >= 75%
    return 'bg-emerald-200'
  }

  const handleKennzeichenClick = (e, fahrzeugId) => {
    e.stopPropagation()
    setSelectedFahrzeugId(fahrzeugId)
  }

  const level = (day) => {
    if (!day || !day.aktiv) return null
    if (day.items.length >= day.maxTermine) return 'voll'
    if ((day.maxTermine - day.items.length) <= 1 || day.auslastung >= 75) return 'knapp'
    return 'frei'
  }
  const BAR = { frei: 'bg-brand-500', knapp: 'bg-amber-500', voll: 'bg-red-600' }
  const LABEL = { frei: 'frei', knapp: 'knapp', voll: 'voll' }
  const pct = (day) => Math.min(100, Math.round((day.items.length / Math.max(1, day.maxTermine)) * 100))

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-9 h-9 grid place-items-center border border-gray-300 bg-white hover:border-gray-900 text-gray-900" aria-label="Vorheriger Monat">
            <ChevronLeftIcon className="w-[18px] h-[18px]" />
          </button>
          <h2 className="font-display text-lg font-light text-gray-900 w-40 text-center">
            {MONATE[month]} {year}
          </h2>
          <button onClick={nextMonth} className="w-9 h-9 grid place-items-center border border-gray-300 bg-white hover:border-gray-900 text-gray-900" aria-label="Nächster Monat">
            <ChevronRightIcon className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-600">
          {['frei', 'knapp', 'voll'].map(k => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`w-3 h-1.5 ${BAR[k]}`} />
              {k === 'frei' ? 'unter 75 %' : k === 'knapp' ? '75–99 %' : 'ausgebucht'}
            </span>
          ))}
        </div>
      </div>

      {/* Mobil: Liste der Öffnungstage */}
      <ul className="md:hidden bg-white border border-gray-200 divide-y divide-gray-200">
        {days.filter(d => d && d.aktiv).map(day => {
          const l = level(day)
          const wd = WOCHENTAGE[(new Date(year, month, day.day).getDay() + 6) % 7]
          return (
            <li key={day.day}>
              <button type="button" onClick={() => setSelectedDay(day)} className={`w-full flex items-center gap-3 px-4 py-3 text-left ${day.isToday ? 'bg-brand-50' : ''}`}>
                <div className="w-12 flex-shrink-0">
                  <div className="eyebrow">{wd}</div>
                  <div className={`font-display text-xl font-light ${day.isToday ? 'text-brand-700' : 'text-gray-900'}`}>{day.day}.</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 bg-gray-100">
                    <div className={`h-full ${BAR[l]}`} style={{ width: `${pct(day)}%` }} />
                  </div>
                  <div className="mt-1.5 text-xs text-gray-600 truncate">
                    {day.items.length > 0 ? day.items.map(it => it.kennzeichen).join(', ') : 'noch keine Termine'}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm tabular-nums text-gray-900">{day.items.length} / {day.maxTermine}</div>
                  <div className="text-[11px] text-gray-500">{LABEL[l]}</div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Desktop: Kalender */}
      <div className="hidden md:flex flex-1 bg-white border border-gray-200 shadow-sm overflow-hidden flex-col">
        <div className="grid grid-cols-7 border-b border-gray-200">
          {WOCHENTAGE.map((tag, i) => (
            <div key={tag} className={`py-2.5 text-center eyebrow ${i >= 5 ? 'opacity-70' : ''}`}>{tag}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
          {days.map((day, i) => {
            const l = level(day)
            return (
              <button
                type="button"
                key={i}
                disabled={!day?.aktiv}
                onClick={() => day?.aktiv && setSelectedDay(day)}
                className={`relative text-left p-3 border-b border-r border-gray-200 transition-colors ${
                  !day ? 'bg-gray-50' : !day.aktiv ? 'bg-gray-50 cursor-default' : 'bg-white hover:bg-gray-50'
                } ${day?.isToday ? 'shadow-[inset_0_0_0_2px_#3A82EA]' : ''}`}
              >
                {day && (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm ${day.isToday ? 'text-brand-700 font-semibold' : day.aktiv ? 'text-gray-900' : 'text-gray-400'}`}>{day.day}</span>
                      {day.isToday && <span className="eyebrow !text-brand-700">heute</span>}
                    </div>
                    {day.aktiv ? (
                      <>
                        <div className="flex-1 flex items-end">
                          <div>
                            <span className="text-[22px] font-light tracking-[-0.5px] tabular-nums text-gray-900">{day.items.length}</span>
                            <span className="text-sm text-gray-500"> / {day.maxTermine}</span>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 bg-gray-100">
                          <div className={`h-full ${BAR[l]}`} style={{ width: `${pct(day)}%` }} />
                        </div>
                        <span className="sr-only">{LABEL[l]}</span>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 mt-1">geschlossen</div>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tag-Details Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 md:p-4" onClick={() => { setSelectedDay(null); setSearchQuery(''); setSearchResults([]); setEditKapazitaet(null); }}>
          <div className="bg-white shadow-lg w-full md:max-w-md overflow-hidden pb-[env(safe-area-inset-bottom)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-display text-lg font-light text-gray-900">
                  {selectedDay.day}. {MONATE[month]} {year}
                  {selectedDay.hasAusnahme && <span className="ml-2 text-xs text-amber-600">Ausnahme</span>}
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedDay.items.length} von {selectedDay.maxTermine} Terminen
                </p>
              </div>
              <button onClick={() => { setSelectedDay(null); setSearchQuery(''); setSearchResults([]); setEditKapazitaet(null); }} className="w-9 h-9 grid place-items-center rounded-full hover:bg-gray-100 text-gray-600" aria-label="Schließen">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Kapazität ändern */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Kapazität für diesen Tag:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={editKapazitaet !== null ? editKapazitaet : selectedDay.maxTermine}
                      onChange={(e) => setEditKapazitaet(parseInt(e.target.value) || 0)}
                      className="field field-sm w-16 text-center"
                    />
                    {editKapazitaet !== null && editKapazitaet !== selectedDay.maxTermine && (
                      <button
                        onClick={handleSaveKapazitaet}
                        className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                      >
                        Speichern
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Fahrzeug hinzufügen */}
              <div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Fahrzeug suchen (Kennzeichen oder Kunde)..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="field w-full"
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                    {searchResults.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleAddFahrzeug(f.id)}
                        className="w-full flex items-center justify-between p-2 hover:bg-emerald-50 text-left border-b border-gray-100 last:border-0"
                      >
                        <span className="font-medium text-gray-900">{f.kennzeichen}</span>
                        <span className="text-xs text-gray-500">{f.kunde || '–'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bestehende Termine */}
              {selectedDay.items.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">Geplante Termine:</p>
                  {selectedDay.items.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setSelectedFahrzeugId(item.fahrzeug_id); setSelectedDay(null); }}
                      className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <span className="font-medium text-gray-900">{item.kennzeichen}</span>
                      <span className="text-xs text-gray-500">{item.typ}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Keine Termine an diesem Tag</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fahrzeug Modal */}
      {selectedFahrzeugId && (
        <FahrzeugModal 
          fahrzeugId={selectedFahrzeugId} 
          token={token} 
          onClose={() => setSelectedFahrzeugId(null)} 
        />
      )}
    </div>
  )
}
