import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { listPositions, createPosition, updatePosition, deletePosition, listEmployeePositions, type PositionRecord, type EmployeePositionRecord } from '@/lib/serverComm';

export function PositionList({ departmentId, selectedId, onSelect, refreshSignal = 0 }: { departmentId: string; selectedId: string | null; onSelect: (id: string) => void; refreshSignal?: number }) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [positions, setPositions] = useState<PositionRecord[] | null>(null);
  const [employeePositions, setEmployeePositions] = useState<EmployeePositionRecord[] | null>(null);

  const load = async () => {
    // Load positions first so layout is ready, then hydrate counts
    const pos = await listPositions(departmentId, q ? { q } : undefined);
    setPositions(pos);
    // Defer employee-positions fetch to next tick to avoid blocking animation
    queueMicrotask(async () => {
      const eps = await listEmployeePositions(departmentId);
      setEmployeePositions(eps);
    });
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId, q, refreshSignal]);

  const countsByPosition = useMemo(() => {
    const map = new Map<string, { total: number; leads: number }>();
    (employeePositions || []).forEach((ep) => {
      const cur = map.get(ep.positionId) || { total: 0, leads: 0 };
      cur.total += 1;
      if (ep.isLead) cur.leads += 1;
      map.set(ep.positionId, cur);
    });
    return map;
  }, [employeePositions]);

  const onCreate = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createPosition(departmentId, { name: name.trim() });
      setPositions(prev => prev ? [created, ...prev] : [created]);
      setCreating(false);
      setName('');
    } catch (e: any) {
      setError(e?.message || 'Failed to create position');
    } finally {
      setSubmitting(false);
    }
  };

  const onRename = async (positionId: string, nextName: string) => {
    const updated = await updatePosition(positionId, { name: nextName.trim() });
    setPositions(prev => (prev || []).map(p => (p.id === positionId ? updated : p)));
  };

  const onDeletePosition = async (positionId: string) => {
    await deletePosition(positionId);
    setPositions(prev => (prev || []).filter(p => p.id !== positionId));
    setEmployeePositions(prev => (prev || []).filter(ep => ep.positionId !== positionId));
    if (selectedId === positionId) onSelect('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input placeholder="Search positions" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button size="sm" onClick={() => setCreating(v => !v)}>{creating ? 'Close' : 'New'}</Button>
      </div>
      {creating && (
        <div className="space-y-2 rounded-md border p-2">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          {error && <div className="text-xs text-destructive">{error}</div>}
          <div className="flex gap-2">
            <Button size="sm" onClick={onCreate} disabled={!name.trim() || submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
            <Button size="sm" variant="outline" onClick={() => { setCreating(false); setName(''); setError(null); }}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="rounded-md border">
        {!positions && (<div className="p-3 text-sm text-muted-foreground">Loading…</div>)}
        {positions && positions.length === 0 && (<div className="p-3 text-sm text-muted-foreground">No positions yet</div>)}
        {positions && positions.length > 0 && (
          <ScrollArea className="h-[420px]">
            <div className="divide-y">
              {positions.map((p) => {
                const counts = countsByPosition.get(p.id) || { total: 0, leads: 0 };
                const isSelected = selectedId === p.id;
                return (
                  <button key={p.id} className={`w-full text-left p-3 hover:bg-muted/50 ${isSelected ? 'bg-muted/60' : ''}`} onClick={() => onSelect(p.id)}>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <Badge variant="secondary">{counts.total}</Badge>
                      {counts.leads > 0 && <Badge variant="default">Lead {counts.leads}</Badge>}
                      <div className="ml-auto">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost">•••</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); const next = prompt('Rename position', p.name); if (next && next.trim()) void onRename(p.id, next.trim()); }}>Rename</DropdownMenuItem>
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); if (confirm('Delete this position?')) void onDeletePosition(p.id); }} className="text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}


