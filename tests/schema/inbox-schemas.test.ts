import { describe, expect, it } from 'vitest';

import { deliveryIdForPacketId } from '../../src/core/local-inbox-adapter.js';
import { schemaService } from '../../src/core/schema-service.js';
import type { InboxConfig, InboxDelivery } from '../../src/types/inbox.js';
import type { AuditEntry } from '../../src/types/records.js';

describe('durable inbox schemas', () => {
  it('accepts exact config and delivery records', () => {
    const config: InboxConfig = {
      schemaVersion: '1.0.0',
      transport: 'local',
      name: 'review-agent',
      address: 'local:review-agent',
      root: '/tmp/3notch-mailbox',
    };
    const delivery = fixtureDelivery();

    expect(schemaService.validate<InboxConfig>('inboxConfig', config).ok).toBe(true);
    expect(schemaService.validate<InboxDelivery>('inboxDelivery', delivery).ok).toBe(true);
  });

  it('rejects extra fields, traversal-shaped addresses, invalid hashes, and invalid states', () => {
    expect(schemaService.validate('inboxConfig', {
      schemaVersion: '1.0.0',
      transport: 'local',
      name: '../reviewer',
      address: 'local:../reviewer',
      root: '/tmp/mailbox',
    }).ok).toBe(false);
    expect(schemaService.validate('inboxDelivery', {
      ...fixtureDelivery(),
      packetHash: 'not-a-hash',
    }).ok).toBe(false);
    expect(schemaService.validate('inboxDelivery', {
      ...fixtureDelivery(),
      state: 'deleted',
    }).ok).toBe(false);
    expect(schemaService.validate('inboxDelivery', {
      ...fixtureDelivery(),
      packetContents: 'must never appear in metadata',
    }).ok).toBe(false);
  });

  it('accepts redacted durable-inbox audit events without packet content', () => {
    const delivery = fixtureDelivery();
    const audit: AuditEntry = {
      schemaVersion: '1.0.0',
      at: '2026-08-04T20:00:00Z',
      operation: 'inbox-send',
      result: 'success',
      actor: { actorType: 'agent', name: 'Codex' },
      actorNameResolution: 'mcp-client',
      actorTypeResolution: 'mcp-default',
      sourceTool: { name: 'notch-mcp' },
      recordType: 'packet',
      recordId: delivery.packetId,
      deliveryId: delivery.deliveryId,
      deliveryState: delivery.state,
      packetHash: delivery.packetHash,
      from: delivery.from,
      to: delivery.to,
      bytes: delivery.bytes,
    };

    expect(schemaService.validate<AuditEntry>('audit', audit).ok).toBe(true);
    expect(JSON.stringify(audit)).not.toContain('packetContents');
  });
});

function fixtureDelivery(): InboxDelivery {
  const packetId = 'packet_schema_fixture';
  return {
    schemaVersion: '1.0.0',
    deliveryId: deliveryIdForPacketId(packetId),
    transport: 'local',
    from: 'local:sender',
    to: 'local:review-agent',
    packetId,
    packetHash: 'a'.repeat(64),
    bytes: 42,
    state: 'pending',
    createdAt: '2026-08-04T20:00:00Z',
    updatedAt: '2026-08-04T20:00:00Z',
  };
}
