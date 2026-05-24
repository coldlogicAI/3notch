# V2 Implementation Log

## 2026-05-24 - Wave 1 substrate

- Added packet relationship schema primitives for `supersedes`, `replyTo`, `replyType`, and reply `status`, while keeping marks and replies as packets.
- Added `.notch/index/relationships.json` as a deterministic derived edge index over explicit packet metadata: `supersedes`, `replyTo`, `co-tagged`, `co-recipient`, and `co-source-link`.
- Added the `NOTCH_RECORD_IMMUTABLE` guard helper for received packet overwrite attempts and documented the import audit path for `supersedes`.
- Verification: `npm test -- packet-schema relationships-service packet-service transfer-service`.
