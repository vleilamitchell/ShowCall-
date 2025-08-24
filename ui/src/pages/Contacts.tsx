import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ListDetailLayout, List, useListDetail, useDebouncedPatch, type ResourceAdapter } from '@/features/listDetail';
 
import { type ContactRecord, listContacts, getContact, createContact, updateContact, deleteContact } from '@/lib/serverComm';

function contactLabel(c: ContactRecord): string {
  const parts = [c.lastName, c.firstName].filter((s) => Boolean(String(s || '').trim()));
  const name = parts.length > 0 ? parts.join(', ') : '';
  const fallback = String(c.email || c.contactNumber || c.id || '').trim();
  return name || fallback || '(unnamed)';
}

export default function Contacts() {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Partial<ContactRecord>>({ firstName: '', lastName: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const adapter: ResourceAdapter<ContactRecord, undefined, { q?: string }> = useMemo(() => ({
    list: async (query) => {
      const rows = await listContacts();
      const needle = (query?.q || '').trim().toLowerCase();
      if (!needle) return rows.sort((a, b) => contactLabel(a).localeCompare(contactLabel(b)));
      return rows
        .filter((c) => {
          const values = [
            c.firstName,
            c.lastName,
            c.email,
            c.contactNumber,
            c.address1,
            c.city,
            c.state,
            c.postalCode,
          ].filter(Boolean).map((v) => String(v).toLowerCase());
          return values.some((v) => v.includes(needle));
        })
        .sort((a, b) => contactLabel(a).localeCompare(contactLabel(b)));
    },
    get: async (id) => getContact(String(id)),
    create: async (partial) => createContact(partial),
    update: async (id, patch) => updateContact(String(id), patch),
    remove: async (id) => deleteContact(String(id)),
    searchableFields: ['firstName','lastName','email','contactNumber','city','state','postalCode']
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
    create,
    remove,
  } = useListDetail<ContactRecord, undefined, { q?: string }>({
    resourceKey: 'contacts',
    adapter,
  });

  const { onChange: onPatchChange, onBlurFlush } = useDebouncedPatch<Partial<ContactRecord>>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateContact(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });

  const onCreate = async () => {
    if (submitting) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      const payload: Partial<ContactRecord> = {
        firstName: String(form.firstName || '').trim() || null,
        lastName: String(form.lastName || '').trim() || null,
        email: String(form.email || '').trim() || null,
      };
      const created = await create(payload as any);
      select(created.id);
      setCreating(false);
      setForm({ firstName: '', lastName: '', email: '' });
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create contact');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ListDetailLayout
      left={(
        <>
          <div className="p-3 border-b space-y-2">
            <Input placeholder="Search contacts" value={queryState.q || ''} onChange={(e) => setQueryState(prev => ({ ...prev, q: e.target.value }))} />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreating(v => !v)} className="gap-1">{creating ? 'Close' : 'New'}</Button>
            </div>
            {creating ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="First" value={String(form.firstName||'')} onChange={(e) => setForm(prev => ({ ...prev, firstName: e.target.value }))} />
                  <Input placeholder="Last" value={String(form.lastName||'')} onChange={(e) => setForm(prev => ({ ...prev, lastName: e.target.value }))} />
                  <Input placeholder="Email" value={String(form.email||'')} onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))} />
                </div>
                {createError && <div className="text-xs text-destructive">{createError}</div>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={onCreate} disabled={submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setCreating(false); setForm({ firstName: '', lastName: '', email: '' }); setCreateError(null); }}>Cancel</Button>
                </div>
              </div>
            ) : null}
          </div>
          <List<ContactRecord>
            items={items}
            selectedId={selectedId}
            onSelect={select}
            loading={loading}
            renderItem={(c) => (
              <>
                <div className="text-sm font-medium truncate">{contactLabel(c)}</div>
                <div className="text-xs text-muted-foreground">{c.email || '—'}{c.contactNumber ? ` • ${c.contactNumber}` : ''}</div>
              </>
            )}
          />
        </>
      )}
      right={(
        <div key={selected?.id || 'none'} className="routeFadeItem detailPaneAccent">
          {!selected ? (
            <div className="text-sm text-muted-foreground">Select a contact</div>
          ) : (
            <div className="max-w-3xl space-y-3">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Prefix</label>
                  <Input value={selected.prefix || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, prefix: e.target.value } : i)); onPatchChange({ prefix: e.target.value }); }} onBlur={() => onBlurFlush()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">First</label>
                  <Input value={selected.firstName || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, firstName: e.target.value } : i)); onPatchChange({ firstName: e.target.value }); }} onBlur={() => onBlurFlush()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Last</label>
                  <Input value={selected.lastName || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, lastName: e.target.value } : i)); onPatchChange({ lastName: e.target.value }); }} onBlur={() => onBlurFlush()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Suffix</label>
                  <Input value={selected.suffix || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, suffix: e.target.value } : i)); onPatchChange({ suffix: e.target.value }); }} onBlur={() => onBlurFlush()} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Address 1</label>
                  <Input value={selected.address1 || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, address1: e.target.value } : i)); onPatchChange({ address1: e.target.value }); }} onBlur={() => onBlurFlush()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Address 2</label>
                  <Input value={selected.address2 || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, address2: e.target.value } : i)); onPatchChange({ address2: e.target.value }); }} onBlur={() => onBlurFlush()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">City</label>
                  <Input value={selected.city || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, city: e.target.value } : i)); onPatchChange({ city: e.target.value }); }} onBlur={() => onBlurFlush()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">State</label>
                  <Input value={selected.state || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, state: e.target.value.toUpperCase() } : i)); onPatchChange({ state: e.target.value.toUpperCase() }); }} onBlur={() => onBlurFlush()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Zip</label>
                  <Input value={selected.postalCode || ''} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0,5); mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, postalCode: v } : i)); onPatchChange({ postalCode: v }); }} onBlur={() => onBlurFlush()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Email</label>
                  <Input value={selected.email || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, email: e.target.value } : i)); onPatchChange({ email: e.target.value }); }} onBlur={() => onBlurFlush()} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Payment Details</label>
                <textarea className="w-full border rounded px-2 py-1 min-h-[120px] text-sm" value={selected.paymentDetails || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, paymentDetails: e.target.value } : i)); onPatchChange({ paymentDetails: e.target.value }); }} onBlur={() => onBlurFlush()} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Contact Number</label>
                  <Input value={selected.contactNumber || ''} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); mutateItems(prev => prev.map(i => i.id === selected.id ? { ...i, contactNumber: v } : i)); onPatchChange({ contactNumber: v }); }} onBlur={() => onBlurFlush()} />
                </div>
              </div>
              <div className="pt-2">
                <Button size="sm" variant="destructive" onClick={() => selected && remove(selected.id)}>Delete</Button>
              </div>
            </div>
          )}
        </div>
      )}
    />
  );
}


