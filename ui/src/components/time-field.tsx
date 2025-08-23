import { useEffect, useMemo, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

type TimeFieldProps = {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  stepMinutes?: number
  placeholder?: string
  pickerStyle?: 'list' | 'columns'
}

function generateTimeOptions(stepMinutes: number): string[] {
  const options: string[] = []
  const step = Math.max(1, Math.min(60, Math.floor(stepMinutes)))
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0')
    const m = String(minutes % 60).padStart(2, '0')
    options.push(`${h}:${m}`)
  }
  return options
}

export function TimeField({ value, onChange, disabled, stepMinutes = 15, placeholder, pickerStyle = 'columns' }: TimeFieldProps) {
  const [open, setOpen] = useState(false)
  const options = useMemo(() => generateTimeOptions(stepMinutes), [stepMinutes])
  const displayLabel = value ? formatTimeTo12Hour(value) : (placeholder || 'Select time')

  const initial = useMemo(() => to12h(value || '00:00'), [value])
  const [hour12, setHour12] = useState<number>(initial.hour)
  const [minute, setMinute] = useState<number>(initial.minute)
  const [period, setPeriod] = useState<'AM' | 'PM'>(initial.period)

  // Do not auto-close on value change; popover stays open until user clicks away
  useEffect(() => {
    if (!open) return
    const { hour, minute, period } = to12h(value || '00:00')
    setHour12(hour); setMinute(minute); setPeriod(period)
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="justify-between w-full"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
        >
          <span className="truncate text-left flex-1 min-w-0">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={pickerStyle === 'list' ? 'p-0 w-48' : 'p-3 w-64'}>
        {pickerStyle === 'list' ? (
          <ScrollArea className="h-60">
            <div role="listbox" aria-label="Select time" className="p-1">
              {options.map((opt) => (
                <button
                  key={opt}
                  className={`w-full text-left text-sm px-2 py-1 rounded hover:bg-muted ${opt === value ? 'bg-muted' : ''}`}
                  onClick={() => { onChange(opt); setOpen(false) }}
                >
                  {formatTimeTo12Hour(opt)}
                </button>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <ScrollArea className="h-48 w-16 border rounded">
                <div className="p-1">
                  {Array.from({ length: 12 }).map((_, idx) => {
                    const h = idx + 1
                    return (
                      <button
                        key={h}
                        className={`w-full text-sm px-2 py-1 rounded hover:bg-muted ${h === hour12 ? 'bg-muted' : ''}`}
                        onClick={() => { setHour12(h); const v24 = to24h({ hour: h, minute, period }); onChange(v24); }}
                      >
                        {h}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
              <ScrollArea className="h-48 w-16 border rounded">
                <div className="p-1">
                  {Array.from({ length: Math.ceil(60 / Math.max(1, Math.min(60, Math.floor(stepMinutes)))) }).map((_, idx) => {
                    const step = Math.max(1, Math.min(60, Math.floor(stepMinutes)))
                    const m = (idx * step) % 60
                    return (
                      <button
                        key={m}
                        className={`w-full text-sm px-2 py-1 rounded hover:bg-muted ${m === minute ? 'bg-muted' : ''}`}
                        onClick={() => { setMinute(m); const v24 = to24h({ hour: hour12, minute: m, period }); onChange(v24); }}
                      >
                        {String(m).padStart(2, '0')}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
              <div className="flex flex-col gap-2">
                {(['AM', 'PM'] as const).map((p) => (
                  <button
                    key={p}
                    className={`w-16 h-6 text-sm px-2 py-1 rounded border hover:bg-muted ${p === period ? 'bg-muted' : ''}`}
                    onClick={() => { setPeriod(p); const v24 = to24h({ hour: hour12, minute, period: p }); onChange(v24); }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export default TimeField


function formatTimeTo12Hour(time24: string): string {
  // Expecting HH:mm, fallback to original if invalid
  const parts = time24.split(':')
  if (parts.length !== 2) return time24
  const hours24 = Number(parts[0])
  const minutes = parts[1]
  if (Number.isNaN(hours24) || minutes.length !== 2) return time24
  const period = hours24 >= 12 ? 'PM' : 'AM'
  let hours12 = hours24 % 12
  if (hours12 === 0) hours12 = 12
  return `${hours12}:${minutes} ${period}`
}

function to12h(time24: string): { hour: number; minute: number; period: 'AM' | 'PM' } {
  const parts = time24.split(':')
  const h24 = Math.max(0, Math.min(23, Number(parts[0] ?? 0)))
  const m = Math.max(0, Math.min(59, Number(parts[1] ?? 0)))
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM'
  let h12 = h24 % 12
  if (h12 === 0) h12 = 12
  return { hour: h12, minute: m, period }
}

function to24h(t: { hour: number; minute: number; period: 'AM' | 'PM' }): string {
  let h = t.hour % 12
  if (t.period === 'PM') h += 12
  const hh = String(h).padStart(2, '0')
  const mm = String(Math.max(0, Math.min(59, t.minute))).padStart(2, '0')
  return `${hh}:${mm}`
}


