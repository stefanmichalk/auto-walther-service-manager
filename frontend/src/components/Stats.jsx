export function Stats({ data }) {
  const mergedCount = Object.keys(data.merged).length

  return (
    <div className="flex items-center gap-6 text-sm">
      <Stat label="HU" value={data.hu.length} />
      <Stat label="Inspektion" value={data.inspektion.length} />
      <Stat label="Service" value={data.service.length} />
      <Stat label="Fahrzeuge" value={mergedCount} />
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
