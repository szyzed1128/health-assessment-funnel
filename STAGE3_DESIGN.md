# Stage 3: Subscription Authorization and Mock Payment Design

## PRD Requirements Mapped to Deliverables

| PRD requirement | Implementation rule | Evidence required before Stage 3 passes |
| --- | --- | --- |
| Free and member results differ by subscription state | `subscription` owns one server-side visibility policy. The result route calls that policy and does not trust a request flag or UI state. | API tests compare response JSON before and after payment. |
| Free users cannot obtain protected data through direct API calls | The free DTO is constructed from an allow-list only. It contains `bmi`, `summary`, and `targetWeightDifferenceKg`; it never serializes calories, target date, forecast, or action plan. | Test asserts protected keys are absent, not merely null or hidden. |
| Active members receive the full report | The member DTO contains BMI, summary, target weight difference, recommended calories, target date, weekly forecast, and action plan when present. | Member result API test. |
| Mock payment activates the correct session subscription | `POST /api/pay` accepts only `sessionId` and a unique `paymentEventId`; the server chooses payment success and membership dates. | Integration test reads subscription state after payment. |
| Duplicate payment callbacks are idempotent | A unique database constraint exists on `PaymentEvent.paymentEventId`. The transaction locks on this ID, returns the original successful outcome for the same session, and rejects reuse by another session. | Same-event retry test proves one event and one subscription record. |
| Payment and entitlement change are reliable | Payment event creation and subscription activation occur in one PostgreSQL transaction. A failure rolls back both. | Repository integration tests and transaction implementation. |
| APIs validate all external input | `sessionId` and `paymentEventId` are UUIDs; a session must exist and have a persisted assessment result before it can be paid. | Invalid payload, missing result, and unknown-session API tests. |

## API Contracts

### `GET /api/sessions/:sessionId/result`

- The session ID is validated server-side.
- `404` means the session does not exist.
- `422` means no server-generated assessment result is available yet.
- `200` returns either a free DTO or member DTO, chosen exclusively from the
  current persisted subscription state.

### `POST /api/pay`

Request body:

```json
{ "sessionId": "UUID", "paymentEventId": "UUID" }
```

- The handler accepts no price, duration, member flag, result data, or payment
  success flag from the client.
- A successful mock subscription runs for 30 days from the server clock.
- Retrying the same event for the same session returns the same successful,
  authorized result without creating another event or subscription.
- Reusing an event ID for a different session returns a conflict error.

## State and Boundary Rules

```text
no subscription / inactive / expired -> free result only
active subscription inside [startsAt, endsAt) -> member result

paymentEventId absent -> create SUCCEEDED event + activate 30-day subscription
same paymentEventId, same session -> idempotent success
same paymentEventId, other session -> conflict
```

The `Subscription` record is the only membership source. `PaymentEvent` is an
auditable callback record, not a client-side token. The result policy will use
an allow-list to guarantee protected keys do not appear in a free JSON response.
