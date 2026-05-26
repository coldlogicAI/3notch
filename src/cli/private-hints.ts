import { printInfo, type CliOutputOptions } from './output.js';
import type { NotchPacket } from '../types/records.js';

export const PRIVATE_PACKET_HINT = 'Private packet: use --private with packet list, show, and preview.';

export function printPrivatePacketHint(packet: Pick<NotchPacket, 'purpose' | 'sensitivity'>, output: CliOutputOptions): void {
  if (packet.purpose === 'seed' || packet.sensitivity === 'private') {
    printInfo(PRIVATE_PACKET_HINT, output);
  }
}
