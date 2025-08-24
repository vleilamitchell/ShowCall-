import { DatabaseConnection } from '../../lib/db';
import * as txRepo from '../../repositories/inventory/transactionsRepo';

export async function listTransactions(params: {
  itemId?: string;
  locationId?: string;
  eventType?: string | string[];
  from?: string; // ISO ts
  to?: string; // ISO ts
  limit?: number;
  order?: 'asc' | 'desc';
}, dbOrTx?: DatabaseConnection) {
  return txRepo.list(params, dbOrTx);
}


