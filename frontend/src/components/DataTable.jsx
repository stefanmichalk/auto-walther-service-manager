import { FileText } from 'lucide-react'

export function DataTable({ data, columns, emptyMessage }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left bg-gray-50">
            {columns.map(col => (
              <th key={col.key} className="p-3 font-medium text-gray-700">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-t hover:bg-gray-50">
              {columns.map(col => (
                <td key={col.key} className={`p-3 ${col.className || ''}`}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] || '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const HU_COLUMNS = [
  { key: 'KdNr', label: 'KdNr', className: 'text-gray-500' },
  { key: 'Name', label: 'Name', className: 'font-medium' },
  { key: 'Kennzeichen', label: 'Kennzeichen' },
  { key: 'Modell', label: 'Modell', className: 'text-gray-600' },
  { key: 'HU_Datum', label: 'HU-Datum' },
  { key: 'KmStand', label: 'KM-Stand' },
]

export const INSP_COLUMNS = [
  { key: 'KdNr', label: 'KdNr', className: 'text-gray-500' },
  { key: 'Name', label: 'Name', className: 'font-medium' },
  { key: 'Kennzeichen', label: 'Kennzeichen' },
  { key: 'Inspektion', label: 'Datum' },
  { key: 'KmStand', label: 'KM-Stand' },
  { key: 'Vermerk', label: 'Vermerk', className: 'text-gray-600' },
]

export const SERVICE_COLUMNS = [
  { key: 'Kennzeichen', label: 'Kennzeichen', className: 'font-medium' },
  { key: 'Faelligkeitsdatum', label: 'Fälligkeit' },
  { key: 'Bezeichnung', label: 'Service' },
  { key: 'Details', label: 'Details', className: 'text-gray-600' },
  { key: 'Name', label: 'Kunde' },
]
