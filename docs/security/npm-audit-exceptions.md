# npm audit exception policy

CI runs `npm audit --audit-level=high` after the clean install. High and critical findings fail the
build.

No active exceptions.

Any future exception must identify the advisory and affected package, explain why remediation is
not yet possible, document compensating controls, name an owner, and include an expiry date. An
expired exception must fail review until it is removed or explicitly renewed with fresh evidence.
