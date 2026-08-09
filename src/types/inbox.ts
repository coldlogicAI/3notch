export type InboxTransport = 'local';
export type InboxDeliveryState = 'pending' | 'pulled' | 'acked' | 'rejected';

export type InboxConfig = {
  schemaVersion: '1.0.0';
  transport: InboxTransport;
  name: string;
  address: string;
  root: string;
};

export type InboxDelivery = {
  schemaVersion: '1.0.0';
  deliveryId: string;
  transport: InboxTransport;
  from: string;
  to: string;
  packetId: string;
  packetHash: string;
  bytes: number;
  state: InboxDeliveryState;
  createdAt: string;
  updatedAt: string;
  pulledAt?: string;
  ackedAt?: string;
  rejectedAt?: string;
  importedAt?: string;
  importedPacketId?: string;
  errorCode?: string;
};

export type InboxDeliverySummary = InboxDelivery & {
  packetPath?: string;
};

export type InboxResult = {
  ok: true;
  deliveryId: string;
  packetId: string;
  packetHash: string;
  state: InboxDeliveryState;
  packetPath: string;
  importedPacketId?: string;
  nextAction: string;
};

export type InboxDeliveryStatusResult = InboxResult & {
  address: string;
  delivery: InboxDelivery;
};
