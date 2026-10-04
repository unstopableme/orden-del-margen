'use strict';

/**
 * Integration contract for concurrent appeal resolution.
 *
 * This repository does not yet contain reviewService.resolveAppeal or its
 * database schema. Keep this test skipped until those components and an
 * isolated disposable PostgreSQL test database exist. The eventual test must
 * exercise the exported service implementation; it must not recreate the
 * transaction algorithm in the test.
 */

const test = require('node:test');

test.skip(
  '[integration contract; implementation pending] resolveAppeal handles a concurrent row modification safely',
  async () => {
    /*
     * Required fixture:
     *
     * 1. Create an appealed review case at version 3, evidence owned by that
     *    case, an authorized reviewer who is not a subject of the case, and a
     *    unique idempotency key.
     * 2. Open two independent database connections. Pause the service call
     *    after it locks/reads the case and use the second connection to produce
     *    a genuine serialization failure (SQLSTATE 40001) or version conflict.
     * 3. Resume the service call and verify the documented fallback:
     *      - retry only errors classified as transient by the service policy;
     *      - use a fresh transaction for every retry;
     *      - enforce a finite retry limit;
     *      - never return success for an uncommitted transaction.
     * 4. Assert the final database state, not only the returned error:
     *      - exactly one terminal case transition;
     *      - exactly one append-only history event;
     *      - exactly one persisted idempotency result;
     *      - case version increments once;
     *      - evidence remains attached to the case;
     *      - no participant association, reward eligibility, snapshot, or
     *        payout state changes.
     * 5. Repeat the identical request and assert that the persisted result is
     *    returned. Reuse the key with different input and assert rejection.
     * 6. Run the competing request with expectedVersion 3 and assert a typed
     *    version-conflict response after the winning transaction commits.
     *
     * Enable this test only by importing the actual exported
     * reviewService.resolveAppeal implementation and supplying disposable
     * database fixtures through the repository's future integration harness.
     */
  }
);
