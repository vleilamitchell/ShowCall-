import { useState } from 'react';
import { Card } from '@/components/ui/card';

type Props = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  toggleLabel?: { open: string; closed: string };
  children: React.ReactNode;
};

export function CreateInline(props: Props) {
  const { open: controlledOpen, onOpenChange, toggleLabel = { open: 'Close', closed: 'New' }, children } = props;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen != null;
  const open = isControlled ? !!controlledOpen : uncontrolledOpen;

  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setUncontrolledOpen(v);
  };

  return (
    <div>
      {!isControlled && (
        <div className="mt-2">
          <button className="inline-flex items-center px-3 py-1.5 text-sm rounded border" onClick={() => setOpen(!open)}>
            {open ? toggleLabel.open : toggleLabel.closed}
          </button>
        </div>
      )}
      <div className={`transition-all duration-300 ${open ? 'grid grid-rows-[1fr] mt-3' : 'grid grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <Card className={`p-3 space-y-2 transform transition-all duration-300 ${open ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
            {children}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default CreateInline;


