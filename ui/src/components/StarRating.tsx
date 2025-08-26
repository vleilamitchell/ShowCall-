import { useMemo } from 'react';
import { Star as StarOutline } from 'lucide-react';

export type StarRatingProps = {
  value: number;
  onChange?: (next: number) => void;
  max?: number;
  size?: number;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
};

export function StarRating({ value, onChange, max = 5, size = 36, disabled, className, 'aria-label': ariaLabel }: StarRatingProps) {
  const clamped = Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
  const stars = useMemo(() => Array.from({ length: max }, (_, i) => i + 1), [max]);

  const handleClick = (idx: number) => {
    if (disabled || !onChange) return;
    onChange(idx);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !onChange) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(max, (clamped || 0) + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(0, (clamped || 0) - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    }
  };

  return (
    <div
      role="slider"
      aria-label={ariaLabel || 'Priority'}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      className={[
        'inline-flex items-center gap-1 select-none',
        disabled ? 'opacity-70 cursor-default' : 'cursor-pointer',
        className || ''
      ].join(' ')}
    >
      {stars.map((idx) => {
        const isActive = idx <= clamped;
        return (
          <button
            key={idx}
            type="button"
            className={[
              'p-0.5 rounded transition-transform',
              disabled ? '' : 'hover:scale-105 active:scale-95'
            ].join(' ')}
            onClick={() => handleClick(idx)}
            aria-label={`${idx} ${idx === 1 ? 'star' : 'stars'}`}
            disabled={disabled}
          >
            <StarOutline
              width={size}
              height={size}
              className={[
                'drop-shadow-sm',
                isActive ? 'text-[color:var(--accent)]' : 'text-muted-foreground'
              ].join(' ')}
              strokeWidth={1.5}
              fill={isActive ? 'currentColor' : 'none'}
            />
          </button>
        );
      })}
    </div>
  );
}

export default StarRating;


