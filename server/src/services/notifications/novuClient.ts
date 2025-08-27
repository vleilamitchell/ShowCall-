import { Novu } from '@novu/node';
import { getNovuApiKey } from '../../lib/env';

let client: Novu | null = null;

export function getNovuClient(): Novu | null {
  const apiKey = getNovuApiKey();
  if (!apiKey) return null;
  if (client) return client;
  client = new Novu(apiKey);
  return client;
}

export async function trigger(templateKey: string, toSubscriberId: string, payload: Record<string, any>, overrides?: Record<string, any>): Promise<{ acknowledged: boolean; id?: string } | null> {
  const c = getNovuClient();
  if (!c) return null;
  const res = await c.trigger(templateKey, {
    to: { subscriberId: toSubscriberId },
    payload,
    overrides,
  } as any);
  // Novu SDK returns an object with acknowledged boolean
  return { acknowledged: Boolean((res as any)?.acknowledged), id: (res as any)?.data?.acknowledged ? (res as any)?.data?._id : undefined } as any;
}


