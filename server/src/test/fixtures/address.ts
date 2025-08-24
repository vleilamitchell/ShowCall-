
type CreateAddressInput = {
  baseUrl: string;
  token: string;
  contactId: string;
};

export async function createMinimalAddress({ baseUrl, token, contactId }: CreateAddressInput) {
  const res = await fetch(`${baseUrl}/addresses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      entityType: 'contact',
      entityId: contactId,
      addressLine1: '1 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      isPrimary: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create address: ${res.status} ${body}`);
  }
  return res.json();
}


