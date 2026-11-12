import { useState, useEffect, useMemo } from 'react'
import { ArchiveBoxIcon, CalendarIcon, MagnifyingGlassIcon } from '../icons'
import { Card, Segmented, StatusTag, Button, EmptyState, VehicleCell, toDE } from './ui'

const clean = (v) => (v || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '')
const todayISO = () => new Date().toISOString().slice(0, 10)

export function ArchivList({ currentUser, token, globalSearch }) {
  const [statusList, setStatusList] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('ausgetragen')
  const [busyVin, setBusyVin] = useState(null)

  const load = async () => {
    try {
      const res = await fetch('/api/db/fahrzeug-status', { headers: { 'Authorization': `Bearer ${token}` } })
      setStatusList(await res.json())
    } catch (err) {
      console.error('Load archive error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (token) load() }, [token])

  const matches = (item) => {
    const t = clean(globalSearch)
    if (!t) return true
    return [item.vin, item.kennzeichen, item.kunde_name, item.austragen_grund, item.wiedervorlage_grund]
      .some(v => clean(v).includes(t))
  }

  const ausgetragen = useMemo(() => statusList
    .filter(s => s.ausgetragen && matches(s))
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')), [statusList, globalSearch])

  const wiedervorlage = useMemo(() => statusList
    .filter(s => s.wiedervorlage_datum && !s.ausgetragen && matches(s))
    .sort((a, b) => (a.wiedervorlage_datum || '').localeCompare(b.wiedervorlage_datum || '')), [statusList, globalSearch])

  // Bei Suche automatisch in den Bereich mit Treffern springen
  useEffect(() => {
    if (!globalSearch) return
    if (activeSection === 'ausgetragen' && ausgetragen.length === 0 && wiedervorlage.length > 0) setActiveSection('wiedervorlage')
    if (activeSection === 'wiedervorlage' && wiedervorlage.length === 0 && ausgetragen.length > 0) setActiveSection('ausgetragen')
  }, [globalSearch, ausgetragen.length, wiedervorlage.length])

  const handleReactivate = async (vin) => {
    setBusyVin(vin)
    try {
      const res = await fetch('/api/db/fahrzeug-status', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin, ausgetragen: false, austragen_grund: null, wiedervorlage_datum: null, wiedervorlage_grund: null })
      })
      if (!res.ok) throw new Error(`Reaktivieren fehlgeschlagen (${res.status})`)
      await load()
    } catch (err) {
      console.error('Reactivate error:', err)
      alert(err.message)
    } finally {
      setBusyVin(null)
    }
  }

  const rows = activeSection === 'ausgetragen' ? ausgetragen : wiedervorlage
  const today = todayISO()

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-center gap-3 px-3 md:px-5 py-3 md:py-4 border-b border-gray-200">
        <Segmented
          value={activeSection}
          onChange={setActiveSection}
          options={[
            { value: 'ausgetragen', label: 'Ausgetragen', icon: ArchiveBoxIcon, count: ausgetragen.length },
            { value: 'wiedervorlage', label: 'Wiedervorlage', icon: CalendarIcon, count: wiedervorlage.length },
          ]}
        />
        <p className="hidden md:block text-sm text-gray-500">
          {activeSection === 'ausgetragen'
            ? 'Fahrzeuge, die nicht mehr angeschrieben werden (verkauft, verzogen, andere Werkstatt …)'
            : 'Fahrzeuge, die zu einem späteren Datum wieder ins Dashboard kommen'}
        </p>
        {globalSearch && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-gray-700">
            <MagnifyingGlassIcon className="w-4 h-4" />
            Suche: „{globalSearch}“
          </span>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-sm text-gray-500">Lade Archiv …</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={globalSearch ? MagnifyingGlassIcon : (activeSection === 'ausgetragen' ? ArchiveBoxIcon : CalendarIcon)}
          title={globalSearch ? 'Keine Treffer im Archiv' : (activeSection === 'ausgetragen' ? 'Keine ausgetragenen Fahrzeuge' : 'Keine Wiedervorlagen')}
          text={globalSearch ? 'Das Fahrzeug ist nicht ausgetragen und hat keine Wiedervorlage. Schau im Dashboard oder unter Fahrzeuge.' : null}
        />
      ) : (
        <>
        {/* Mobil: Karten */}
        <ul className="md:hidden divide-y divide-gray-200">
          {rows.map(item => {
            const isWv = activeSection === 'wiedervorlage'
            const due = isWv && item.wiedervorlage_datum <= today
            const isToday = isWv && item.wiedervorlage_datum === today
            return (
              <li key={item.vin} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <VehicleCell kennzeichen={item.kennzeichen} kunde={item.kunde_name} vin={item.vin} />
                  {isWv
                    ? <StatusTag status={isToday ? 'heute' : due ? 'überfällig' : 'wiedervorlage'}>{toDE(item.wiedervorlage_datum)}</StatusTag>
                    : <span className="text-xs text-gray-500 tabular-nums">{toDE(item.updated_at)}</span>}
                </div>
                <p className="mt-2 text-sm text-gray-900">{(isWv ? item.wiedervorlage_grund : item.austragen_grund) || <span className="text-gray-500">kein Grund angegeben</span>}</p>
                <div className="mt-2">
                  <Button size="sm" variant="secondary" disabled={busyVin === item.vin} onClick={() => handleReactivate(item.vin)}>
                    {isWv ? 'Zurück ins Dashboard' : 'Reaktivieren'}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 pl-5 pr-3 text-left">Fahrzeug</th>
                <th className="py-3 px-3 text-left">Status</th>
                <th className="py-3 px-3 text-left">Grund</th>
                <th className="py-3 px-3 text-left">{activeSection === 'ausgetragen' ? 'Ausgetragen am' : 'Wiedervorlage am'}</th>
                <th className="py-3 pl-3 pr-5 text-right"><span className="sr-only">Aktion</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(item => {
                const isWv = activeSection === 'wiedervorlage'
                const due = isWv && item.wiedervorlage_datum <= today
                const isToday = isWv && item.wiedervorlage_datum === today
                return (
                  <tr key={item.vin} className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 pl-5 pr-3 align-top"><VehicleCell kennzeichen={item.kennzeichen} kunde={item.kunde_name} vin={item.vin} /></td>
                    <td className="py-3 px-3 align-top">
                      {isWv
                        ? <StatusTag status={isToday ? 'heute' : due ? 'überfällig' : 'wiedervorlage'}>{isToday ? 'heute fällig' : due ? 'fällig' : 'geplant'}</StatusTag>
                        : <StatusTag status="ausgetragen" />}
                    </td>
                    <td className="py-3 px-3 align-top text-gray-900 max-w-md">{(isWv ? item.wiedervorlage_grund : item.austragen_grund) || <span className="text-gray-500">kein Grund angegeben</span>}</td>
                    <td className={`py-3 px-3 align-top tabular-nums ${due ? 'text-red-600' : 'text-gray-700'}`}>
                      {toDE(isWv ? item.wiedervorlage_datum : item.updated_at)}
                    </td>
                    <td className="py-3 pl-3 pr-5 align-top text-right">
                      <Button size="sm" variant="secondary" disabled={busyVin === item.vin} onClick={() => handleReactivate(item.vin)}>
                        {isWv ? 'Zurück ins Dashboard' : 'Reaktivieren'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </Card>
  )
}
