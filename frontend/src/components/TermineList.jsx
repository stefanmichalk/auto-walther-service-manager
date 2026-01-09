import { 
  ExclamationTriangleIcon, 
  ClockIcon,
  CalendarDaysIcon 
} from '@heroicons/react/24/outline'

export function TermineList({ termine }) {
  if (termine.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <CalendarDaysIcon className="w-12 h-12 mx-auto mb-4 stroke-1" />
        <p className="text-sm">Keine Termine geladen</p>
      </div>
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const getStatus = (datumStr) => {
    let date
    if (datumStr.includes('/')) {
      const [y, m, d] = datumStr.split('/')
      date = new Date(y, m - 1, d)
    } else {
      const [d, m, y] = datumStr.split('.')
      date = new Date(y, m - 1, d)
    }
    date.setHours(0, 0, 0, 0)
    const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24))
    
    if (diff < 0) return { status: 'overdue', label: 'Überfällig', days: diff }
    if (diff === 0) return { status: 'today', label: 'Heute', days: 0 }
    if (diff <= 7) return { status: 'soon', label: `${diff}d`, days: diff }
    return { status: 'future', label: `${diff}d`, days: diff }
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="w-8 pb-3"></th>
            <th className="w-28 pb-3 text-left font-medium text-gray-500">Datum</th>
            <th className="w-16 pb-3 text-left font-medium text-gray-500">Typ</th>
            <th className="w-28 pb-3 text-left font-medium text-gray-500">Kennzeichen</th>
            <th className="pb-3 text-left font-medium text-gray-500">Kunde</th>
            <th className="w-48 pb-3 text-left font-medium text-gray-500">Details</th>
            <th className="w-24 pb-3 text-right font-medium text-gray-500">km</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {termine.map((t, i) => {
            const s = getStatus(t.datum)
            const isOverdue = s.status === 'overdue'
            const isSoon = s.status === 'soon' || s.status === 'today'
            
            return (
              <tr key={i} className={`hover:bg-gray-50/50 ${isOverdue ? 'bg-red-50/30' : ''}`}>
                <td className="py-2.5 pr-2">
                  {isOverdue ? (
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
                  ) : isSoon ? (
                    <ClockIcon className="w-4 h-4 text-amber-400" />
                  ) : (
                    <ClockIcon className="w-4 h-4 text-gray-300" />
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <span className={`tabular-nums ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                    {t.datum.includes('/') ? t.datum.split('/').reverse().join('.') : t.datum}
                  </span>
                  <span className={`ml-2 text-xs ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                    {s.label}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    t.type === 'HU' ? 'bg-sky-100 text-sky-700' :
                    t.type === 'Inspektion' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {t.type === 'Inspektion' ? 'Insp.' : t.type}
                  </span>
                </td>
                <td className="py-2.5 pr-4 font-medium text-gray-900">{t.kennzeichen || '–'}</td>
                <td className="py-2.5 pr-4 text-gray-600 truncate max-w-[200px]">{t.kunde}</td>
                <td className="py-2.5 pr-4 text-gray-500 truncate max-w-[180px]">{t.details || '–'}</td>
                <td className="py-2.5 text-right text-gray-400 tabular-nums">
                  {t.kmStand ? `${Number(t.kmStand).toLocaleString('de-DE')}` : '–'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
        {termine.length} Termine
      </div>
    </div>
  )
}
