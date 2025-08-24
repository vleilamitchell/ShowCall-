import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { ListDetailLayout, List, useListDetail, useDebouncedPatch, type ResourceAdapter } from '@/features/listDetail';
 
import { type ContactRecord, listContacts, getContact, createContact, updateContact, deleteContact } from '@/lib/serverComm';

function computedName(c: ContactRecord): string {
  const parts = [c.lastName, c.firstName].filter((s) => Boolean(String(s || '').trim()));
  const name = parts.length > 0 ? parts.join(', ') : '';
  if (name) return name;
  const email = String(c.email || '').trim();
  if (email) return email;
  const phone = String(c.contactNumber || '').trim();
  if (phone) return phone;
  return String(c.id || '(unnamed)');
}

export default function Contacts() {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Partial<ContactRecord>>({
    prefix: '',
    firstName: '',
    lastName: '',
    suffix: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postalCode: '',
    email: '',
    organization: '',
    paymentDetails: '',
    contactNumber: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(null);

  const adapter: ResourceAdapter<ContactRecord, any, { q?: string }> = useMemo(() => ({
    list: async (query) => {
      const rows = await listContacts();
      const needle = (query?.q || '').trim().toLowerCase();
      if (!needle) return rows.sort((a, b) => computedName(a).localeCompare(computedName(b)));
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
            c.organization,
          ].filter(Boolean).map((v) => String(v).toLowerCase());
          return values.some((v) => v.includes(needle));
        })
        .sort((a, b) => computedName(a).localeCompare(computedName(b)));
    },
    get: async (id: string) => getContact(String(id)),
    create: async (partial) => createContact(partial),
    update: async (id: string, patch) => updateContact(String(id), patch),
    searchableFields: ['firstName','lastName','email','contactNumber','city','state','postalCode','organization']
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
  } = useListDetail<ContactRecord>({
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
        prefix: String(form.prefix || '').trim() || null,
        firstName: String(form.firstName || '').trim() || null,
        lastName: String(form.lastName || '').trim() || null,
        suffix: String(form.suffix || '').trim() || null,
        address1: String(form.address1 || '').trim() || null,
        address2: String(form.address2 || '').trim() || null,
        city: String(form.city || '').trim() || null,
        state: String(form.state || '').trim().toUpperCase() || null,
        postalCode: String(form.postalCode || '').replace(/\D/g, '').slice(0,5) || null,
        email: String(form.email || '').trim() || null,
        organization: String(form.organization || '').trim() || null,
        paymentDetails: String(form.paymentDetails || '').trim() || null,
        contactNumber: String(form.contactNumber || '').replace(/\D/g, '') || null,
      };
      const created = await create(payload as any);
      select(created.id);
      setCreating(false);
      setForm({
        prefix: '', firstName: '', lastName: '', suffix: '', address1: '', address2: '', city: '', state: '', postalCode: '', email: '', organization: '', paymentDetails: '', contactNumber: ''
      });
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
          </div>
          <List<ContactRecord>
            items={items}
            selectedId={selectedId}
            onSelect={select}
            loading={loading}
            renderItem={(c) => (
              <>
                <div className="text-sm font-medium truncate">{computedName(c)}</div>
                <div className="text-xs text-muted-foreground">{c.organization || c.email || '—'}{(!c.organization && c.contactNumber) ? ` • ${c.contactNumber}` : ''}</div>
              </>
            )}
            renderActions={(item) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onClick={async () => {
                    const id = String(item.id);
                    const currentIndex = items.findIndex(i => String(i.id) === id);
                    await deleteContact(id);
                    mutateItems(prev => prev.filter(i => String(i.id) !== id));
                    if (selectedId && String(selectedId) === id) {
                      const next = items[currentIndex + 1] || items[currentIndex - 1];
                      if (next) select(next.id);
                      else select(null as any);
                    }
                  }}>Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </>
      )}
      right={(
        <div key={selected?.id || (creating ? 'creating' : 'none')} className="routeFadeItem detailPaneAccent">
          <div className="sticky top-0 z-[2] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-3 py-2 flex items-center justify-between">
            <div className="text-sm font-medium">{creating ? 'New Contact' : (selected ? computedName(selected) : 'Select a contact')}</div>
            <div className="flex items-center gap-2">
              {creating ? (
                <>
                  <Button size="sm" onClick={onCreate} disabled={submitting}>{submitting ? 'Saving…' : 'Save'}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setCreating(false); setForm({ firstName: '', lastName: '', email: '', organization: '' }); if (prevSelectedId) select(prevSelectedId); setCreateError(null); }}>Cancel</Button>
                </>
              ) : (
                <Button size="sm" onClick={() => { setPrevSelectedId(selectedId); setCreating(true); }}>+ New</Button>
              )}
            </div>
          </div>
          {!selected && !creating ? (
            <div className="p-3 text-sm text-muted-foreground">Select a contact</div>
          ) : (
            <div className="max-w-3xl space-y-3 p-3">
              {creating ? (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Prefix</label>
                      <Input value={String(form.prefix||'')} onChange={(e) => setForm(prev => ({ ...prev, prefix: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">First</label>
                      <Input value={String(form.firstName||'')} onChange={(e) => setForm(prev => ({ ...prev, firstName: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Last</label>
                      <Input value={String(form.lastName||'')} onChange={(e) => setForm(prev => ({ ...prev, lastName: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Suffix</label>
                      <Input value={String(form.suffix||'')} onChange={(e) => setForm(prev => ({ ...prev, suffix: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Address 1</label>
                      <Input value={String(form.address1||'')} onChange={(e) => setForm(prev => ({ ...prev, address1: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Address 2</label>
                      <Input value={String(form.address2||'')} onChange={(e) => setForm(prev => ({ ...prev, address2: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">City</label>
                      <Input value={String(form.city||'')} onChange={(e) => setForm(prev => ({ ...prev, city: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">State</label>
                      <Input value={String(form.state||'')} onChange={(e) => setForm(prev => ({ ...prev, state: e.target.value.toUpperCase() }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Zip</label>
                      <Input value={String(form.postalCode||'')} onChange={(e) => setForm(prev => ({ ...prev, postalCode: e.target.value.replace(/\D/g,'').slice(0,5) }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Email</label>
                      <Input value={String(form.email||'')} onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Organization</label>
                      <Input value={String(form.organization||'')} onChange={(e) => setForm(prev => ({ ...prev, organization: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Payment Details</label>
                    <textarea className="w-full border rounded px-2 py-1 min-h-[120px] text-sm" value={String(form.paymentDetails||'')} onChange={(e) => setForm(prev => ({ ...prev, paymentDetails: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Contact Number</label>
                      <Input value={String(form.contactNumber||'')} onChange={(e) => setForm(prev => ({ ...prev, contactNumber: e.target.value.replace(/\D/g,'') }))} />
                    </div>
                  </div>
                  {createError && <div className="text-xs text-destructive">{createError}</div>}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Prefix</label>
                      <Input value={selected!.prefix || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, prefix: e.target.value } : i)); onPatchChange({ prefix: e.target.value }); }} onBlur={() => onBlurFlush()} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">First</label>
                      <Input value={selected!.firstName || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, firstName: e.target.value } : i)); onPatchChange({ firstName: e.target.value }); }} onBlur={() => onBlurFlush()} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Last</label>
                      <Input value={selected!.lastName || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, lastName: e.target.value } : i)); onPatchChange({ lastName: e.target.value }); }} onBlur={() => onBlurFlush()} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Suffix</label>
                      <Input value={selected!.suffix || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, suffix: e.target.value } : i)); onPatchChange({ suffix: e.target.value }); }} onBlur={() => onBlurFlush()} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Address 1</label>
                      <Input value={selected!.address1 || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, address1: e.target.value } : i)); onPatchChange({ address1: e.target.value }); }} onBlur={() => onBlurFlush()} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Address 2</label>
                      <Input value={selected!.address2 || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, address2: e.target.value } : i)); onPatchChange({ address2: e.target.value }); }} onBlur={() => onBlurFlush()} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">City</label>
                      <Input value={selected!.city || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, city: e.target.value } : i)); onPatchChange({ city: e.target.value }); }} onBlur={() => onBlurFlush()} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">State</label>
                      <Input value={selected!.state || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, state: e.target.value.toUpperCase() } : i)); onPatchChange({ state: e.target.value.toUpperCase() }); }} onBlur={() => onBlurFlush()} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Zip</label>
                      <Input value={selected!.postalCode || ''} onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0,5); mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, postalCode: v } : i)); onPatchChange({ postalCode: v }); }} onBlur={() => onBlurFlush()} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Email</label>
                      <Input value={selected!.email || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, email: e.target.value } : i)); onPatchChange({ email: e.target.value }); }} onBlur={() => onBlurFlush()} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Organization</label>
                      <Input value={selected!.organization || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, organization: e.target.value } : i)); onPatchChange({ organization: e.target.value }); }} onBlur={() => onBlurFlush()} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Payment Details</label>
                    <textarea className="w-full border rounded px-2 py-1 min-h-[120px] text-sm" value={selected!.paymentDetails || ''} onChange={(e) => { mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, paymentDetails: e.target.value } : i)); onPatchChange({ paymentDetails: e.target.value }); }} onBlur={() => onBlurFlush()} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Contact Number</label>
                      <Input value={selected!.contactNumber || ''} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); mutateItems(prev => prev.map(i => i.id === selected!.id ? { ...i, contactNumber: v } : i)); onPatchChange({ contactNumber: v }); }} onBlur={() => onBlurFlush()} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    />
  );
}


