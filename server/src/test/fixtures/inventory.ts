
type Auth = { token: string };
type Ctx = { baseUrl: string } & Auth;

export async function listItems({ baseUrl, token }: Ctx) {
  const res = await fetch(`${baseUrl}/inventory/items`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`listItems failed: ${res.status}`);
  return res.json();
}

export async function createTransaction({ baseUrl, token }: Ctx, payload: any) {
  const res = await fetch(`${baseUrl}/inventory/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createTransaction failed: ${res.status}`);
  return res.json();
}


