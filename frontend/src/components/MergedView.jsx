import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

export function MergedView({ data }) {
  const [expandedVins, setExpandedVins] = useState({})

  const toggleVin = (vin) => {
    setExpandedVins(prev => ({ ...prev, [vin]: !prev[vin] }))
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">Keine Fahrzeuge geladen</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {data.map((vehicle) => (
        <div key={vehicle.Fahrgestellnr}>
          <button
            onClick={() => toggleVin(vehicle.Fahrgestellnr)}
            className="w-full flex items-center gap-4 py-3 hover:bg-gray-50/50 transition text-left group"
          >
            {expandedVins[vehicle.Fahrgestellnr] ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900">{vehicle.Kennzeichen || '–'}</span>
                {vehicle.Hersteller && (
                  <span className="text-xs font-medium px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{vehicle.Hersteller}</span>
                )}
                {vehicle.Modell && (
                  <span className="text-sm text-gray-500 truncate">{vehicle.Modell}</span>
                )}
              </div>
              <div className="text-xs text-gray-400 font-mono mt-0.5">
                VIN: {vehicle.Fahrgestellnr}
              </div>
            </div>
            
            <div className="flex gap-1.5">
              {vehicle.hu?.length > 0 && (
                <span className="text-xs font-medium px-1.5 py-0.5 bg-sky-100 text-sky-700 rounded">
                  {vehicle.hu.length} HU
                </span>
              )}
              {vehicle.inspektion?.length > 0 && (
                <span className="text-xs font-medium px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                  {vehicle.inspektion.length} Insp.
                </span>
              )}
              {vehicle.service?.length > 0 && (
                <span className="text-xs font-medium px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                  {vehicle.service.length} Svc.
                </span>
              )}
            </div>
          </button>

          {expandedVins[vehicle.Fahrgestellnr] && (
            <div className="pl-8 pb-4 space-y-3">
              {vehicle.Kunde?.Name && (
                <div className="text-sm text-gray-600">
                  <span className="text-gray-400">Kunde:</span> {vehicle.Kunde.Anrede} {vehicle.Kunde.Name}
                  {vehicle.Kunde.Telefon && <span className="ml-4 text-gray-400">Tel: {vehicle.Kunde.Telefon}</span>}
                </div>
              )}

              {vehicle.hu?.length > 0 && (
                <div className="text-sm">
                  <span className="text-gray-400">HU:</span>
                  {vehicle.hu.map((e, i) => (
                    <span key={i} className="ml-2 text-gray-700">{e.HU_Datum}</span>
                  ))}
                </div>
              )}

              {vehicle.inspektion?.length > 0 && (
                <div className="text-sm">
                  <span className="text-gray-400">Insp.:</span>
                  {vehicle.inspektion.map((e, i) => (
                    <span key={i} className="ml-2 text-gray-700">{e.Inspektion} <span className="text-gray-400">{e.Vermerk}</span></span>
                  ))}
                </div>
              )}

              {vehicle.service?.length > 0 && (
                <div className="text-sm">
                  <span className="text-gray-400">Service:</span>
                  {vehicle.service.map((e, i) => (
                    <span key={i} className="ml-2 text-gray-700">{e.Faelligkeitsdatum} <span className="text-gray-400">{e.Bezeichnung}</span></span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      <div className="pt-4 text-xs text-gray-400">{data.length} Fahrzeuge</div>
    </div>
  )
}
