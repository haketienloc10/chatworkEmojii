# Exec Plan

## Goal

Provide local-only Settings and safe sticker lifecycle management.

## Scope

In scope:

- Options page, popup link and visibility controls.
- Local order, trash/restore/undo, pack preferences, data backup, health check.

Out of scope:

- Device sync and remote services.

## Risk Classification

Risk flags:

- Data model, data loss, existing behavior, public UI contract, multi-domain.

Hard gates:

- Permanent deletion of imported records is confirmation-gated.

## Work Phases

1. Define versioned local data contract.
2. Build Settings UI and popup link.
3. Apply preferences in picker and Quick Reactions.
4. Add lifecycle actions and tests.
5. Validate and record proof.

## Stop Conditions

Pause for confirmation if permanent deletion needs to cover bundled source data
or if a remote synchronization requirement is introduced.
