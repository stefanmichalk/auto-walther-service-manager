export function Stats({ faelligkeiten = [], statusMap = {} }) {
  const offen = faelligkeiten.filter(f => {
    const status = statusMap[f.vin]
    return !status?.ausgetragen && !status?.wiedervorlage_datum && f.bearbeitungs_status !== 'angeschrieben' && f.bearbeitungs_status !== 'termin'
  }).length

  const angeschrieben = faelligkeiten.filter(f => {
    const status = statusMap[f.vin]
    return !status?.ausgetragen && f.bearbeitungs_status === 'angeschrieben'
  }).length

  const termin = faelligkeiten.filter(f => {
    const status = statusMap[f.vin]
    return !status?.ausgetragen && f.bearbeitungs_status === 'termin'
  }).length

  const nachfassen = faelligkeiten.filter(f => {
    const status = statusMap[f.vin]
    return !status?.ausgetragen && status?.wiedervorlage_datum
  }).length

  return (
    <div className="flex items-center gap-4 text-sm">
      <Stat label="Offen" value={offen} />
      <Stat label="Angeschrieben" value={angeschrieben} />
      <Stat label="Termin" value={termin} />
      <Stat label="Nachfassen" value={nachfassen} />
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  )
}
