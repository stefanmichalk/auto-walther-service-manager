// Kleine UI-Bausteine im CrowdInsights-Look (Marke Blau).
// Ziel: alle Listen sehen gleich aus und verhalten sich gleich.

export function Card({ className = '', children }) {
  return <div className={`bg-white border border-gray-200 shadow-sm ${className}`}>{children}</div>
}

export function CardHeader({ title, sub, right }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-200">
      <div className="min-w-0">
        <h2 className="font-display text-[17px] font-normal tracking-[-0.2px] text-gray-900">{title}</h2>
        {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  )
}

// Segmented control: Pill-Spur, aktives Segment weiß mit blauer Unterkante
export function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex max-w-full items-center gap-1 p-1 rounded-full bg-gray-100 overflow-x-auto" role="tablist">
      {options.map(o => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`inline-flex flex-shrink-0 items-center gap-2 px-3 md:px-4 py-1.5 rounded-full text-sm transition-colors ${
              active ? 'bg-white text-gray-900 shadow-[inset_0_-2px_0_#3A82EA,0_1px_2px_rgb(32_31_36/.06)]' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {o.icon && <o.icon className="w-4 h-4" />}
            {o.label}
            {o.count !== undefined && (
              <span className="font-mono text-[11px] text-gray-500">{o.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const TAG_DOTS = {
  offen: 'bg-gray-400',
  angeschrieben: 'bg-sky-500',
  termin: 'bg-brand-500',
  wiedervorlage: 'bg-amber-500',
  'überfällig': 'bg-red-600',
  ausgetragen: 'bg-red-600',
  heute: 'bg-amber-500',
}

// Status immer mit Punkt + Text, nie nur Farbe
export function StatusTag({ status, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-gray-900 whitespace-nowrap">
      <span className={`w-2 h-2 rounded-full ${TAG_DOTS[status] || 'bg-gray-400'}`} />
      {children || status}
    </span>
  )
}

export function Button({ variant = 'secondary', size = 'md', className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-display font-semibold uppercase tracking-[0.1em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { md: 'min-h-[40px] px-4 text-[12.5px]', sm: 'min-h-[32px] px-3 text-[11.5px]' }
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-white text-gray-900 border border-gray-900 hover:bg-gray-100',
    ghost: 'text-gray-900 underline underline-offset-4 hover:text-brand-700 normal-case tracking-normal font-sans font-normal text-sm',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    'danger-outline': 'bg-white text-red-600 border border-red-600 hover:bg-red-50',
  }
  return (
    <button type="button" className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-gray-500" />
        </div>
      )}
      <p className="font-display text-lg font-light text-gray-900">{title}</p>
      {text && <p className="text-sm text-gray-500 mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Fahrzeug-Zelle: Kennzeichen, Kunde, VIN
export function VehicleCell({ kennzeichen, kunde, vin }) {
  return (
    <div className="min-w-0">
      <div className="text-sm font-medium text-gray-900">{kennzeichen || '–'}</div>
      {kunde && <div className="text-xs text-gray-600 truncate">{kunde}</div>}
      {vin && <div className="font-mono text-[11px] text-gray-500">{vin}</div>}
    </div>
  )
}

export const toDE = (d) => {
  if (!d) return '–'
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(d)) return d
  const x = new Date(d)
  if (isNaN(x)) return d
  return x.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
