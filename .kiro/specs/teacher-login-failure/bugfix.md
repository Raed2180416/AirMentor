# Bugfix Requirements Document

## Introduction

Teacher accounts (specifically `kavitha.rao`) cannot access the teacher portfolio after a sysadmin creates a proof run. The login flow succeeds at the credential level but fails when the teacher portal attempts to bootstrap academic data, resulting in a "NO_ACTIVE_PROOF_RUN" error that manifests to the user as "invalid credentials" or "server not live".

The root cause is that seeded faculty accounts (like `kavitha.rao` with faculty ID `t1`) exist in the platform seed data but are not included in the `PROOF_FACULTY` list. When a proof run is created, only `PROOF_FACULTY` members (like `devika.shetty`) get their data populated for the proof simulation. Seeded faculty have credentials and role grants but no offerings, students, or other academic context needed for the teacher portal to function.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a teacher with a seeded faculty account (e.g., `kavitha.rao`) attempts to login after a proof run is created THEN the system returns an authentication failure even though the credentials are valid

1.2 WHEN the teacher portal calls `/api/academic/bootstrap` for a seeded faculty account THEN the system throws a `NO_ACTIVE_PROOF_RUN` error because the seeded faculty is not part of the proof simulation

1.3 WHEN a sysadmin creates a proof run THEN only `PROOF_FACULTY` members get their academic context (offerings, students, mentor assignments) populated, leaving seeded faculty accounts without functional access

### Expected Behavior (Correct)

2.1 WHEN a teacher with a seeded faculty account attempts to login after a proof run is created THEN the system SHALL either allow access with appropriate academic context OR provide a clear error message explaining that the account is not part of the active proof simulation

2.2 WHEN the teacher portal calls `/api/academic/bootstrap` for a faculty account THEN the system SHALL return appropriate data if the faculty is part of an active proof run OR return a clear error indicating the faculty is not part of the simulation

2.3 WHEN a sysadmin creates a proof run THEN the system SHALL either include seeded faculty accounts in the proof simulation OR clearly document that only `PROOF_FACULTY` accounts can access the teacher portal during proof runs

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a `PROOF_FACULTY` member (e.g., `devika.shetty`) logs in after a proof run is created THEN the system SHALL CONTINUE TO allow successful login and full access to the teacher portfolio

3.2 WHEN a sysadmin logs in THEN the system SHALL CONTINUE TO have full access to all admin features regardless of proof run status

3.3 WHEN the `/api/academic/bootstrap` endpoint is called with an active proof run THEN the system SHALL CONTINUE TO return the full academic portal data for faculty members who are part of the simulation

3.4 WHEN no proof run is active THEN the system SHALL CONTINUE TO block academic portal access with the `NO_ACTIVE_PROOF_RUN` error for all faculty accounts
