# Security Policy

## Supported Versions

Security updates are applied to the latest active development version.

## Reporting a Vulnerability

If you discover a vulnerability:

1. Do not disclose it publicly.
2. Share details privately with project maintainers.
3. Include steps to reproduce, impact, and suggested mitigation if known.

Expected response process:

- Acknowledgment within 72 hours
- Triage and impact assessment
- Patch planning and coordinated disclosure

## Secrets and Credentials

- Keep all credentials in local or managed secret stores.
- Do not commit real keys to git history.
- Rotate any key that is accidentally exposed.
- Limit service-role and database credentials to least privilege.

## Application Security Practices

- Validate all API inputs.
- Enforce authentication and role checks on protected routes.
- Encrypt stored credentials at rest.
- Log security-relevant actions for auditing.

## Dependency Hygiene

- Keep dependencies updated regularly.
- Apply security patches promptly.
- Run lint/build checks before release.
