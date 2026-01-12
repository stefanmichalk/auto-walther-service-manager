import { useState, useEffect } from 'react'
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  PlusCircleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
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

  return (
    <div className="h-full flex flex-col -mt-6 -mx-8 px-8">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 w-44 text-center">
            {MONATE[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-200"></div>
            <span>&lt;75%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-200"></div>
            <span>75-99%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-200"></div>
            <span>≥100%</span>
          </div>
        </div>
      </div>

      {/* Kalender - volle Höhe */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
        {/* Wochentag-Header */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {WOCHENTAGE.map((tag, i) => (
            <div 
              key={tag} 
              className={`py-2 text-center text-sm font-medium ${
                i >= 5 ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* Tage - flex-1 für volle Höhe */}
        <div className="grid grid-cols-7 flex-1">
          {days.map((day, i) => (
            <div
              key={i}
              onClick={() => day?.aktiv && setSelectedDay(day)}
              className={`p-3 border-b border-r border-gray-100 cursor-pointer transition-all hover:brightness-95 ${getAuslastungColor(day)} ${
                day?.isToday ? 'ring-2 ring-inset ring-emerald-500' : ''
              }`}
            >
              {day && (
                <div className="h-full flex flex-col">
                  <div className={`text-sm font-medium ${day.isToday ? 'text-emerald-600' : 'text-gray-600'}`}>
                    {day.day}
                  </div>
                  
                  {day.aktiv && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        {day.items.length > 0 ? (
                          <>
                            {day.items.length >= day.maxTermine ? (
                              <XCircleIcon className="w-8 h-8 mx-auto text-red-500 mb-1" />
                            ) : (day.maxTermine - day.items.length) <= 1 || day.auslastung >= 75 ? (
                              <ExclamationCircleIcon className="w-8 h-8 mx-auto text-amber-500 mb-1" />
                            ) : (
                              <CheckCircleIcon className="w-8 h-8 mx-auto text-emerald-500 mb-1" />
                            )}
                            <div className="text-lg font-bold text-gray-700">{day.items.length} <span className="text-sm font-normal text-gray-500">/ {day.maxTermine}</span></div>
                          </>
                        ) : (
                          <PlusCircleIcon className="w-8 h-8 mx-auto text-gray-400" />
                        )}
                      </div>
                    </div>
                  )}
                  
                  {!day.aktiv && (
                    <div className="text-xs text-gray-300 mt-1">geschl.</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tag-Details Modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => { setSelectedDay(null); setSearchQuery(''); setSearchResults([]); setEditKapazitaet(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">
                  {selectedDay.day}. {MONATE[month]} {year}
                  {selectedDay.hasAusnahme && <span className="ml-2 text-xs text-amber-600">⚡ Ausnahme</span>}
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedDay.items.length} von {selectedDay.maxTermine} Terminen
                </p>
              </div>
              <button onClick={() => { setSelectedDay(null); setSearchQuery(''); setSearchResults([]); setEditKapazitaet(null); }} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                ✕
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
                      className="w-16 px-2 py-1 text-sm border border-gray-200 rounded text-center"
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
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
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
