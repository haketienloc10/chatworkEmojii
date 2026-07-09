# US-005 Upload Import Workflow High-Risk Exec Plan

## Goal

Implement extension-owned Chatwork image upload so adding a sticker no longer
requires manually uploading an image and then editing data files.

## Scope

In scope:

- Observe Chatwork upload request metadata.
- Add popup file upload UI.
- Upload selected file through the active Chatwork tab/session.
- Store imported sticker metadata and reload picker data.
- Update tests and durable docs.

Out of scope:

- Live Chrome/Chatwork E2E if browser access is unavailable.
- Static data migration.
- Message sending after upload.

## Risk Classification

Risk flags:

- External systems.
- Public contracts.
- Existing behavior.
- Weak proof.

Hard gates:

- External provider behavior.

## Work Phases

1. Replace DOM-observe import with network-observed upload flow.
2. Add background `webRequest` upload config capture.
3. Add popup file upload action.
4. Add unit/integration tests for upload parsing, request construction, storage,
   and duplicate handling.
5. Update story, product docs, decision, proof, and trace.

## Stop Conditions

Pause for human confirmation if:

- Chatwork upload requires credentials or fields unavailable to extension code.
- A live upload would send a real file without explicit user action.
- Validation must be weakened below local unit/integration proof.
