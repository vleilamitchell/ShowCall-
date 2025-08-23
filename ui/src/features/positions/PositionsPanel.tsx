import { useState } from 'react';
import { PositionList } from './PositionList';
import { PositionDetail } from './PositionDetail';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export function PositionsPanel({ departmentId }: { departmentId: string }) {
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [open, setOpen] = useState(false);

  const notifyChanged = () => setRefreshSignal((v) => v + 1);

  return (
    <div className="mt-6">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors"
            aria-expanded={open}
          >
            <span className="text-sm font-semibold">Positions</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent
          className="overflow-hidden transition-[max-height,opacity] duration-400 ease-out data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-[state=open]:max-h-[2000px] data-[state=closed]:max-h-0"
          style={{ willChange: 'opacity, max-height' }}
        >
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <PositionList
                departmentId={departmentId}
                selectedId={selectedPositionId}
                onSelect={setSelectedPositionId}
                refreshSignal={refreshSignal}
              />
            </div>
            <div className="md:col-span-2">
              {selectedPositionId ? (
                <PositionDetail
                  departmentId={departmentId}
                  positionId={selectedPositionId}
                  onChanged={notifyChanged}
                />
              ) : (
                <div className="text-sm text-muted-foreground">Select a position to manage assignments</div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default PositionsPanel;


