export const itemTypes = [
  'Consumable',
  'ReturnableAsset',
  'FixedAsset',
  'Perishable',
  'Rental',
  'Kit',
] as const;

export type ItemType = typeof itemTypes[number];

export const eventTypes = [
  'RECEIPT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'CONSUMPTION',
  'WASTE',
  'COUNT_ADJUST',
  'RESERVATION_HOLD',
  'RESERVATION_RELEASE',
  'MOVE_OUT',
  'MOVE_IN',
  'MAINTENANCE_START',
  'MAINTENANCE_END',
] as const;

export type EventType = typeof eventTypes[number];


