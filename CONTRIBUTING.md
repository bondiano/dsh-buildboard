# Contributing to dsh-cult-canvas

Thank you for contributing to `dsh-cult-canvas`!

## Code Quality Standards

This project maintains strict quality bars:

- **TypeScript**: Strict typechecking (`npx tsc --noEmit`) with zero errors.
- **Linter**: Zero warnings allowed under `oxlint --deny-warnings .`.
- **Formatter**: Consistent formatting checked via `oxfmt --check .`.
- **Tests**: Automated regression tests executed via `bun test` or `npm test`.

## Development Workflow

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run quality checks:
   ```bash
   npm run check
   ```
3. Run tests:
   ```bash
   bun test
   ```
