import { PageHeader } from '@/components/design/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

export default function Inventory() {
  return (
    <div className="p-4 space-y-4">
      <PageHeader>
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-semibold">Inventory</h1>
          <span className="text-sm text-muted-foreground">On-hand, Availability, Recent Transactions</span>
        </div>
      </PageHeader>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">On-hand (placeholder)</CardContent></Card>
        <Card><CardContent className="p-4">Availability (placeholder)</CardContent></Card>
        <Card><CardContent className="p-4">Recent Transactions (placeholder)</CardContent></Card>
      </div>
    </div>
  );
}


