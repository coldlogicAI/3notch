# Security Policy

## Supported Versions

Baton is pre-1.0. Security fixes should target the main branch until a release policy exists.

## Reporting a Vulnerability

Please open a private security advisory on GitHub when the repository is hosted, or contact the maintainer privately before public disclosure.

## V1 Security Rules

- Baton stores project context locally by default.
- Baton must not add telemetry, analytics, cloud sync, or hosted dependencies in V1.
- Baton must not expose arbitrary shell execution through MCP.
- Baton should reject unsafe paths, symlinks inside `.baton/`, and source links that resolve outside the project.
- Baton should keep source records human-readable so users can inspect what agents wrote.
