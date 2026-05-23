# Security Policy

## Supported Versions

3Notch is pre-1.0. Security fixes should target the main branch until a release policy exists.

## Reporting a Vulnerability

Please open a private security advisory on GitHub when the repository is hosted, or contact the maintainer privately before public disclosure.

## V1 Security Rules

- 3Notch stores project context locally by default.
- 3Notch must not add telemetry, analytics, cloud sync, or hosted dependencies in V1.
- 3Notch must not expose arbitrary shell execution through MCP.
- 3Notch should reject unsafe paths, symlinks inside `.notch/`, and source links that resolve outside the project.
- 3Notch should keep source records human-readable so users can inspect what agents wrote.
