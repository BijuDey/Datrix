# Contributing

Thank you for contributing to Datrix.

## Development Principles

- Keep changes focused and scoped.
- Prefer readable and modular code.
- Avoid breaking public API behavior without clear migration notes.
- Add tests or verification steps for behavior changes.

## Getting Started

1. Fork and clone the repository.
2. Create a feature branch.
3. Follow SETUP.md.
4. Make your changes.
5. Run quality checks:

```bash
npm run lint
npm run build
```

6. Open a pull request with clear context.

## Branch Naming

Use descriptive branch names, for example:

- feature/mongodb-support
- fix/schema-endpoint-timeout
- docs/setup-improvements

## Commit Guidelines

- Use clear, imperative subject lines.
- Keep each commit logically grouped.

Examples:

- feat: add storage explorer filter controls
- fix: handle null schema response in query route
- docs: add deployment and security guides

## Pull Request Checklist

- [ ] Scope is clear and minimal
- [ ] Lint/build pass locally
- [ ] Documentation updated (if needed)
- [ ] Env/config changes documented
- [ ] Backward compatibility considered

## Code Style

- TypeScript-first approach.
- Keep components and API handlers focused.
- Reuse types from the types folder where possible.
- Use existing utility helpers before adding new abstractions.

## Reporting Issues

Please include:

- Summary and expected behavior
- Reproducible steps
- Relevant logs or screenshots
- Environment details (OS, Node version)

## Security Vulnerabilities

Do not post sensitive vulnerabilities publicly.

Follow SECURITY.md for responsible reporting guidance.
