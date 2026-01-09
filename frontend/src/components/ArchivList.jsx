import { useState, useEffect } from 'react'
import { 
  TrashIcon, 
  ArrowPathIcon,
  CalendarIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

export function ArchivList({ currentUser }) {
  const [archivData, setArchivData] = useState({ ausgetragen: [], wiedervorlage: [] })
  const [activeSection, setActiveSection] = useState('ausgetragen')

  useEffect(() => {
    fetch('/api/db/fahrzeug-status')
      .then(res => res.json())
      .then(statusList => {
        const ausgetragen = statusList.filter(s => s.ausgetragen)
        const wiedervorlage = statusList.filter(s => s.wiedervorlage_datum && !s.ausgetragen)
        setArchivData({ ausgetragen, wiedervorlage })
      })
      .catch(err => console.error('Load archive error:', err))
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('de-DE')
  }

  const handleReactivate = async (vin) => {
    try {
      const current = archivData.ausgetragen.find(s => s.vin === vin) || 
                      archivData.wiedervorlage.find(s => s.vin === vin)
      await fetch('/api/db/fahrzeug-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vin,
          angeschrieben: current?.angeschrieben || false,
          service_termin: current?.service_termin || '',
          nachgefasst: current?.nachgefasst || false,
          ausgetragen: false,
          austragen_grund: null,
          wiedervorlage_datum: null,
          wiedervorlage_grund: null,
          user_name: currentUser || 'System'
        })
      })
      // Reload
      const res = await fetch('/api/db/fahrzeug-status')
      const statusList = await res.json()
      const ausgetragen = statusList.filter(s => s.ausgetragen)
      const wiedervorlage = statusList.filter(s => s.wiedervorlage_datum && !s.ausgetragen)
      setArchivData({ ausgetragen, wiedervorlage })
    } catch (err) {
      console.error('Reactivate error:', err)
    }
  }

  return (
    <div>
      {/* Section Tabs */}
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setActiveSection('ausgetragen')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'ausgetragen'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <TrashIcon className="w-4 h-4" />
          Ausgetragen
          <span className="ml-1 px-1.5 py-0.5 bg-white rounded text-xs">
            {archivData.ausgetragen.length}
          </span>
        </button>
        <button
          onClick={() => setActiveSection('wiedervorlage')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSection === 'wiedervorlage'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          Wiedervorlage
          <span className="ml-1 px-1.5 py-0.5 bg-white rounded text-xs">
            {archivData.wiedervorlage.length}
          </span>
        </button>
      </div>

      {/* Content */}
      {activeSection === 'ausgetragen' && (
        <div>
          {archivData.ausgetragen.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              Keine ausgetragenen Fahrzeuge
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-left font-medium text-gray-500">VIN</th>
                  <th className="pb-3 text-left font-medium text-gray-500">Grund</th>
                  <th className="pb-3 text-left font-medium text-gray-500">Datum</th>
                  <th className="pb-3 text-right font-medium text-gray-500">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {archivData.ausgetragen.map(item => (
                  <tr key={item.vin} className="hover:bg-gray-50">
                    <td className="py-3 font-mono text-xs text-gray-600">
                      {item.vin?.substring(0, 17) || '-'}
                    </td>
                    <td className="py-3 text-gray-900">
                      {item.austragen_grund || '-'}
                    </td>
                    <td className="py-3 text-gray-500">
                      {formatDate(item.updated_at)}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleReactivate(item.vin)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Reaktivieren
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeSection === 'wiedervorlage' && (
        <div>
          {archivData.wiedervorlage.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              Keine Wiedervorlagen
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="pb-3 text-left font-medium text-gray-500">VIN</th>
                  <th className="pb-3 text-left font-medium text-gray-500">Wiedervorlage am</th>
                  <th className="pb-3 text-left font-medium text-gray-500">Grund</th>
                  <th className="pb-3 text-right font-medium text-gray-500">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {archivData.wiedervorlage.map(item => {
                  const isToday = item.wiedervorlage_datum === new Date().toISOString().split('T')[0]
                  const isPast = new Date(item.wiedervorlage_datum) < new Date()
                  return (
                    <tr key={item.vin} className={`hover:bg-gray-50 ${isPast ? 'bg-amber-50' : ''}`}>
                      <td className="py-3 font-mono text-xs text-gray-600">
                        {item.vin?.substring(0, 17) || '-'}
                      </td>
                      <td className={`py-3 font-medium ${isPast ? 'text-amber-600' : 'text-gray-900'}`}>
                        {formatDate(item.wiedervorlage_datum)}
                        {isToday && <span className="ml-2 text-xs text-amber-600">(Heute!)</span>}
                      </td>
                      <td className="py-3 text-gray-600">
                        {item.wiedervorlage_grund || '-'}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleReactivate(item.vin)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Erledigt
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
