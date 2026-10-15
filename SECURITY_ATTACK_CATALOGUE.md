# Shopademia Security Scenario Catalogue

The detailed machine-readable catalogue is [SECURITY_TEST_MATRIX.json](./SECURITY_TEST_MATRIX.json). It contains exactly 1,000 entries with IDs `SHOP-SEC-0001` through `SHOP-SEC-1000`. Each entry has a unique combination of security control, actual component/trust boundary, and precondition/context; the catalogue is an assessment plan, not a list of 1,000 vulnerabilities or executed tests.

## Allocation and status

| Domain | Scenarios |
|---|---:|
| A. Architecture, assets, trust boundaries and threat modeling | 40 |
| B. Authentication, passwords, account recovery and identity proofing | 70 |
| C. Sessions, cookies, tokens, MFA and lifecycle security | 80 |
| D. Authorization, IDOR/BOLA, privilege escalation and tenant isolation | 80 |
| E. SQL injection, PostgreSQL query safety and database access paths | 70 |
| F. API validation, mass assignment, excessive exposure and API abuse | 90 |
| G. XSS, CSRF, CORS, browser isolation and client security | 70 |
| H. Checkout, pricing, discounts, inventory and order business logic | 80 |
| I. File uploads, image processing, path traversal and storage | 45 |
| J. Server configuration, secrets, environment handling and deployment boundaries | 65 |
| K. Docker, reverse proxies, TLS, networking and infrastructure | 55 |
| L. PostgreSQL permissions, transactions, data integrity and recovery | 55 |
| M. SSRF, redirects, URL parsing and unsafe integrations | 35 |
| N. Availability, rate limits, resource controls and safe failure | 35 |
| O. Privacy, logging, retention and sensitive-data exposure | 45 |
| P. CI/CD, GitHub Actions, source control and supply-chain controls | 35 |
| Q. Accessibility-related security, UI trust and interaction safety | 20 |
| R. Backup restoration, rollback, migrations and operational recovery | 25 |
| S. Additional project-specific risks and multi-step attack chains | 5 |
| **Total** | **1,000** |

Each JSON record includes applicability, execution status, severity/rationale, safe validation, evidence requirements, regression method, retest state, and residual risk. `NOT TESTED` is not a pass. Runtime-dependent cases requiring an active isolated preview or administrator credentials are `BLOCKED`; features absent from the implementation are `NOT APPLICABLE` with an explanation. Automated mock/API evidence is explicitly identified as such.

| Catalogue status | Count |
|---|---:|
| PASS | 23 |
| FAIL | 2 |
| BLOCKED | 62 |
| NOT TESTED | 888 |
| NOT APPLICABLE | 25 |
| **Total** | **1,000** |

Applicability: 974 applicable, 1 needs confirmation, and 25 not applicable. The current measured automated test run was 124 passed, 0 failed, 0 skipped. This count is separate from catalogue scenario counts; a single suite test does not imply that every related scenario passed.
The current measured automated test run was 124 passed, 0 failed, 0 skipped. This count is separate from catalogue scenario counts; a single suite test does not imply that every related scenario passed.

## References

- OWASP Top 10:2025.
- OWASP API Security Top 10:2023.
- OWASP ASVS 5.0.0.
- OWASP Web Security Testing Guide v4.2.
- MITRE CWE catalog v4.20.
- Node.js v22 process documentation.

The source register and applicability notes are included in [SECURITY_TEST_REPORT.md](./SECURITY_TEST_REPORT.md).
