# Repository conventions

- Repositories should be thin wrappers around SQL/Drizzle queries.
- Accept an explicit database connection; do not read globals.
- Return plain data records; leave HTTP shaping to route handlers.
- Do not throw framework-specific errors; throw `AppError` subclasses if needed.


