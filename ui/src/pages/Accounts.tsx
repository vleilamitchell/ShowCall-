import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ListDetailLayout, List, useListDetail, useDebouncedPatch, type ResourceAdapter } from '@/features/listDetail';
import { type AccountRecord, listAccounts, getAccount, updateAccount, deleteAccount } from '@/lib/serverComm';
import { Trash2 } from 'lucide-react';

function displayName(a: AccountRecord): string {
  return (a.display_name?.trim() || a.email || a.id).trim();
}

export default function Accounts() {
  const adapter: ResourceAdapter<AccountRecord, {}, { q?: string }> = useMemo(() => ({
    list: async (query) => {
      const rows = await listAccounts({ q: query?.q });
      const sorted = [...rows].sort((a, b) => displayName(a).localeCompare(displayName(b)));
      return sorted;
    },
    get: async (id: string) => getAccount(String(id)),
    create: async (_partial) => {
      throw new Error('Account creation is not supported from this screen.');
    },
    update: async (id: string, patch) => updateAccount(String(id), patch as any),
    searchableFields: ['display_name', 'email']
  }), []);

  const {
    items,
    loading,
    selectedId,
    selected,
    select,
    mutateItems,
    queryState,
    setQueryState,
  } = useListDetail<AccountRecord>({
    resourceKey: 'accounts',
    adapter,
  });

  const { onChange: onPatchChange, onBlurFlush } = useDebouncedPatch<Partial<AccountRecord>>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateAccount(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });

  return (
    <ListDetailLayout
      left={(
        <>
          <div className="p-3 border-b space-y-2">
            <Input placeholder="Search accounts" value={queryState.q || ''} onChange={(e) => setQueryState(prev => ({ ...prev, q: e.target.value }))} />
            <div className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? 'account' : 'accounts'}</div>
          </div>
          <List<AccountRecord>
            items={items}
            selectedId={selectedId}
            onSelect={select}
            loading={loading}
            renderItem={(a) => (
              <>
                <div className="text-sm font-medium truncate">{displayName(a)}</div>
                <div className="text-xs text-muted-foreground">{a.email}</div>
              </>
            )}
          />
        </>
      )}
      right={(
        <div key={selected?.id || 'none'} className="routeFadeItem detailPaneAccent">
          {!selected ? (
            <div className="p-3 text-sm text-muted-foreground">Select an account to view details</div>
          ) : (
            <div className="max-w-3xl space-y-3 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Display Name</label>
                  <Input value={selected.display_name || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, display_name: e.target.value } : i)); onPatchChange({ display_name: e.target.value }); }} onBlur={() => onBlurFlush()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Email</label>
                  <Input value={selected.email || ''} readOnly />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Photo URL</label>
                  <div className="flex gap-2">
                    <Input value={selected.photo_url || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, photo_url: e.target.value } : i)); onPatchChange({ photo_url: e.target.value }); }} onBlur={() => onBlurFlush()} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Created</label>
                  <Input value={selected.created_at ? new Date(selected.created_at).toLocaleString() : ''} readOnly />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Updated</label>
                  <Input value={selected.updated_at ? new Date(selected.updated_at).toLocaleString() : ''} readOnly />
                </div>
              </div>
              <div className="flex justify-end pt-3 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1"
                  onClick={async () => {
                    if (!selected) return;
                    const confirmed = window.confirm('Delete this account? This will also remove the Firebase auth user. This cannot be undone.');
                    if (!confirmed) return;
                    const id = selected.id;
                    try {
                      await deleteAccount(id);
                      mutateItems(prev => prev.filter(i => i.id !== id));
                    } catch (e: any) {
                      alert(e?.message || 'Failed to delete account');
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4" /> Delete Account
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    />
  );
}


