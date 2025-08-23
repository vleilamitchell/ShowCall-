import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

type DateFieldProps = {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  placeholder?: string
}

export function DateField({ value, onChange, disabled, placeholder }: DateFieldProps) {
  const [open, setOpen] = useState(false)

  const selectedDate: Date | undefined = useMemo(() => {
    if (!value) return undefined
    try { return parseISO(value) } catch { return undefined }
  }, [value])

  const displayLabel = value || placeholder || 'Select date'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="justify-between w-full"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
        >
          <span className="truncate text-left flex-1 min-w-0">{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return
            const formatted = format(date, 'yyyy-MM-dd')
            onChange(formatted)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export default DateField


