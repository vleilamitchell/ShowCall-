import { useState } from 'react';
import { PositionList } from './PositionList';
import { PositionDetail } from './PositionDetail';
import { Rollup } from '@/components/ui/rollup';

export function PositionsPanel({ departmentId }: { departmentId: string }) {
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('positionsRollupOpen') === '1'; } catch { return false; }
  });

  const notifyChanged = () => setRefreshSignal((v) => v + 1);

  return (
    <div className="mt-6">
      <Rollup title="Positions" storageKey="positionsRollupOpen">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </Rollup>
    </div>
  );
}

export default PositionsPanel;


