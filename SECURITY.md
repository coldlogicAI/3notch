# Security Policy

## Supported Versions

3Notch is pre-1.0. Security fixes target the `main` branch. Once a 1.0 release cuts, this section will pin a support window.

## Reporting A Vulnerability

If you believe you've found a security issue:

1. **Do not open a public issue or PR** that describes the vulnerability.
2. Open a private security advisory via GitHub's "Report a vulnerability" flow on the repository, or contact the maintainer privately before public disclosure.
3. Include a reproduction, the observed impact, and (if possible) a suggested fix or mitigation.

Please give the maintainer a reasonable window to respond before disclosing publicly. Vague reports without reproductions ("the scanner missed a pattern that might be a secret") and unverified scanner output are not actionable — please verify before reporting.

## Out Of Scope

- Local filesystem privilege escalation by an already-authenticated user.
- The secret scanner missing benign content. The scanner is a guardrail, not a proof.
- Bundle authorship spoofing. 3Notch does not sign bundles; SHA-256 hashing only proves bytes did not change in transit.

For the full operational security story — what 3Notch scans, audits, and refuses to overwrite — see [docs/reference/security-story.md](docs/reference/security-story.md).

## Security Invariants 3Notch Maintains

- Records under `.notch/` are stored locally. No data leaves the machine without an explicit `notch packet pack` + user-initiated transfer.
- No telemetry, analytics, cloud sync, or hosted dependencies.
- No arbitrary shell execution through MCP.
- Path-safety checks reject absolute paths, parent traversal, symlinks inside `.notch/`, and source links resolving outside the project root.
- Imported packet folders are immutable: `packet.md`, `manifest.json`, and any file under `artifacts/` must continue to match the recorded SHA-256 values.
- Private records under `.notch/private/` are hidden from MCP unless the server starts with `--include-private`.

A break of any invariant above is in scope for a security report.
