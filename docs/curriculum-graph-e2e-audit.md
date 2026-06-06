# Curriculum Graph Builder — End-to-End Audit & Findings

**Date:** 2026-06-28
**Scope:** Full-stack audit of curriculum graph builder (backend routes, DB schema, frontend component, API client, types, integration)

---

## 1. Executive Summary

The curriculum graph builder feature is structurally sound but had several integration gaps that prevented it from working end-to-end:

| Issue | Severity | Status |
|-------|----------|--------|
| Missing DB migrations for graph draft tables | **P0** | Fixed (0028 migration created) |
| Frontend-backend type mismatch (GraphNode / GraphEdge) | **P0** | Fixed |
| Missing API client methods for graph mutations | **P1** | Fixed |
| Backend validation too strict on same-semester prerequisites | **P1** | Fixed |
| Frontend component lacks save/draft wiring | **P1** | Partial — API methods added, component still uses raw fetch for undo/redo/publish |
| Publish endpoint untested in full lifecycle | **P2** | Pending re-test after validation fix |
| `Loader2` CSS animation missing | **P3** | Fixed in prior session |

---

## 2. Deep Codebase Analysis

### 2.1 Backend: `curriculum-graph-routes.ts`

**File:** `air-mentor-api/src/modules/curriculum-graph-routes.ts`

#### What it does
Registers 9 API endpoints under `/api/admin/batches/:batchId/curriculum-graph`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Load graph bundle (nodes + edges + history + suggestions + validation) |
| POST | `/draft` | Save / upsert draft with optional command history |
| POST | `/validate` | Run graph validation on provided or active-draft nodes/edges |
| POST | `/publish` | Publish draft → new curriculum import version + queue ML simulation |
| POST | `/undo` | Undo last command by restoring reverse payload |
| POST | `/redo` | Redo last undone command by restoring forward payload |
| POST | `/suggest` | Generate LLM-based edge suggestions |
| POST | `/suggestions/:id/approve` | Approve a suggestion |
| POST | `/suggestions/:id/reject` | Reject a suggestion |

#### Validation logic (`validateGraph`)
Checks for:
1. Self-referential edges
2. Edges referencing missing nodes
3. Duplicate edges (same source/target/kind)
4. **Semester order violations** — source semester must be `<` target semester
5. Prerequisite cycles (DFS-based)
6. Disconnected/orphan nodes (warning)
7. Missing topic partitions (warning)

**Finding:** The semester order check used `>=` instead of `>`, which incorrectly flagged same-semester prerequisites as **errors** instead of warnings. Many real curricula have co-requisites or same-semester soft prerequisites.

**Fix applied:** Changed `>=` to `>`; same-semester edges now produce a **warning** suggesting they be marked as corequisite.

#### Publish logic
- Creates a new `curriculumImportVersions` row
- Inserts new `curriculumNodes` and `curriculumEdges` rows
- Marks draft as `published`
- Queues an ML proof simulation run via `enqueueProofSimulationRun`

**Finding:** The `createNewImportVersionFromDraft` function compiles a `CompiledCurriculumWorkbook` and calls `buildCompletenessCertificate`. It requires `resolveBatchPolicy` and `resolveBatchCurriculumFeatures` from `admin-structure.ts`, which exist.

#### Undo/Redo logic
- Stores full graph snapshot in `curriculumGraphHistory` (command payload + reverse payload)
- Toggles `isUndone` flag on history rows
- Restores graph by parsing the stored JSON payload

**Finding:** Undo/redo does **not** validate that the restored payload represents a valid graph. A malformed reverse payload could create dangling edges. Consider adding validation after restore.

---

### 2.2 Database Schema

**File:** `air-mentor-api/src/db/schema.ts`

#### New tables added (prior session)
- `curriculumGraphDrafts` — stores draft JSON blobs
- `curriculumGraphHistory` — stores undo/redo command stack
- `curriculumGraphSuggestions` — stores LLM-generated suggestions

#### New columns added (prior session)
- `curriculumEdges.sourceOutcomeId`
- `curriculumEdges.targetOutcomeId`
- `curriculumEdges.semesterDelta`

#### Critical finding: NO MIGRATION EXISTS for the new tables

The schema definitions were added to `schema.ts`, but the `schema_migrations` table had no entry creating the physical tables. This caused all draft/history/suggestion DB operations to fail with:

```
error: relation "curriculum_graph_drafts" does not exist
```

**Fix applied:** Created migration `0028_curriculum_graph_draft_tables.sql` with CREATE TABLE statements for all three tables.

#### `curriculumEdges` column check
The `mapDbEdgeToDraft` function references:
- `edge.sourceCurriculumNodeId`
- `edge.targetCurriculumNodeId`

These columns exist in `curriculumEdges` and were already present via migration `0026_careless_secret_warriors.sql` (which added `source_outcome_id`, `target_outcome_id`, `semester_delta`). The node ID columns were already there.

---

### 2.3 Frontend: API Types

**File:** `src/api/types.ts`

Types added in prior session:
- `ApiGraphNode` — draft node shape
- `ApiGraphEdge` — draft edge shape
- `ApiGraphSuggestion` — suggestion shape
- `ApiCurriculumGraphBundle` — full response bundle

These types are correct and match the backend response shape.

---

### 2.4 Frontend: API Client

**File:** `src/api/client.ts`

#### Finding: Only `getCurriculumGraph` existed
The `AirMentorApiClientLike` interface and `AirMentorApiClient` class only implemented the GET endpoint. All mutation endpoints (save draft, publish, undo, redo, validate, suggest, approve, reject) were missing.

**Fix applied:** Added 8 new methods to both interface and implementation:
- `saveCurriculumGraphDraft`
- `validateCurriculumGraph`
- `publishCurriculumGraph`
- `undoCurriculumGraph`
- `redoCurriculumGraph`
- `suggestCurriculumGraph`
- `approveCurriculumGraphSuggestion`
- `rejectCurriculumGraphSuggestion`

---

### 2.5 Frontend: `curriculum-graph-workspace.tsx`

**File:** `src/curriculum-graph-workspace.tsx`

#### Finding 1: `apiNodesToGraphNodes` produced invalid `GraphNode` objects
```typescript
// BEFORE — invalid fields
{
  label: n.courseCode,
  subtitle: n.title,          // ❌ does not exist on GraphNode
  meta: `Sem ${n.semesterNumber} · ${n.credits}cr`, // ❌ does not exist
  data: n,                    // ❌ does not exist
}
```

The `ObsidianGraph` renderer uses:
- `code` for the primary course label
- `label` for the secondary subtitle below the node
- `semesterNumber` for layout force positioning

**Fix applied:**
```typescript
// AFTER
{
  code: n.courseCode,
  label: `${n.title} · Sem ${n.semesterNumber} · ${n.credits}cr`,
  semesterNumber: n.semesterNumber,
}
```

#### Finding 2: `apiEdgesToGraphEdges` cast backend `edgeKind` unsafely
Backend edge kinds: `explicit | added | corequisite | cross_semester`
Frontend `GraphEdgeKind`: `prerequisite | parent-child`

The code used `e.edgeKind as GraphEdge['kind']` which is a lie — `explicit` is not a valid `GraphEdgeKind`.

**Fix applied:** Added `mapEdgeKind()` helper:
```typescript
explicit / added → 'prerequisite'
corequisite / cross_semester → 'parent-child'
```

#### Finding 3: Component uses raw `fetch()` for mutations instead of `apiClient`
The undo, redo, and publish handlers call `fetch()` directly with hardcoded paths and CSRF token extraction. This works but bypasses the centralized API client (which handles base URL, CSRF, JSON parsing, and error handling).

**Status:** The new `apiClient` methods exist, but the component still uses raw `fetch`. Recommended to refactor to use `apiClient` for consistency.

#### Finding 4: No "Save Draft" UI action
The component renders a toolbar with Undo, Redo, and Publish buttons, but there is no visible "Save Draft" button. The only way to create a draft is implicitly through other operations. For a graph builder where users drag nodes and draw edges, a manual save action (or auto-save) is essential.

**Recommended:** Add a "Save" button that calls `apiClient.saveCurriculumGraphDraft()` with the current graph state.

#### Finding 5: Suggestions are loaded but not rendered
The bundle includes `suggestions: ApiGraphSuggestion[]`, but the component does not display them in the UI. The LLM-assisted feature is effectively invisible.

**Recommended:** Add a suggestions panel or overlay that shows pending suggestions with Approve / Reject actions.

---

### 2.6 Frontend: `obsidian-graph.tsx`

**File:** `src/obsidian-graph.tsx`

The graph renderer is a D3 canvas-based component. It expects:
- `GraphNode` with `id`, `kind`, `label`, `code?`, `semesterNumber?`, `x?`, `y?`, etc.
- `GraphEdge` with `id`, `source`, `target`, `kind`, `weight?`

No issues found in the renderer itself. The integration mismatches were all in the adapter layer (`curriculum-graph-workspace.tsx`).

---

### 2.7 Integration: `system-admin-faculties-workspace.tsx`

**File:** `src/system-admin-faculties-workspace.tsx`

The `CurriculumGraphWorkspace` is embedded in the "Curriculum Model Inputs" section and receives `batchId` and `apiClient` props. The integration is correct.

---

## 3. Data Flow Trace

```
DB Tables
  curriculumImportVersions
  curriculumNodes  ←────┐
  curriculumEdges   ←────┤  seed data (msruas-mnc-curriculum.json)
  courseTopicPartitions  │  via msruas-proof-sandbox.ts
  bridgeModules         │
                         │
  curriculumGraphDrafts  │  ←── new tables (had no migration)
  curriculumGraphHistory │
  curriculumGraphSuggestions
                         │
GET /api/admin/batches/:batchId/curriculum-graph
  ├─ Load latest import version
  ├─ If active draft exists → parse draft JSON
  ├─ Else → loadGraphFromImportVersion() (maps DB rows → DraftNode/DraftEdge)
  ├─ Load history rows for undo/redo flags
  ├─ Load pending suggestions
  ├─ Run validateGraph()
  └─ Return ApiCurriculumGraphBundle

POST /draft
  ├─ Upsert draft JSON into curriculumGraphDrafts
  ├─ If command provided → append to curriculumGraphHistory
  └─ Return { ok, draftId }

POST /publish
  ├─ Get active draft
  ├─ validateGraph() → must have 0 errors
  ├─ createNewImportVersionFromDraft()
  │   ├─ Insert new curriculumImportVersions row
  │   ├─ Insert new curriculumNodes rows
  │   ├─ Insert new curriculumEdges rows
  │   ├─ Insert courseTopicPartitions
  │   └─ Update import version with checksum + certificate
  ├─ Mark draft as published
  ├─ enqueueProofSimulationRun() → queues ML validation
  └─ Return { ok, newImportVersionId }
```

---

## 4. E2E Test Suite

**File:** `air-mentor-api/tests/curriculum-graph-routes.test.ts`

Created a comprehensive 16-test suite covering:
- GET with unknown batch → 404
- GET with batch lacking curriculum import → 404 / NO_IMPORT
- GET with seeded MNC batch → returns full bundle
- POST /draft → creates draft in DB
- POST /draft with command → records history
- POST /validate → returns errors/warnings
- POST /validate with self-edge → detects error
- POST /validate with cycle → detects error
- POST /undo → toggles isUndone flag, updates canUndo/canRedo
- POST /redo → restores forward payload
- POST /publish with valid draft → creates import version + nodes + edges
- POST /publish with invalid draft → 400 VALIDATION_FAILED
- POST /suggest → generates and stores suggestions
- POST /suggestions/:id/approve → updates status
- POST /suggestions/:id/reject → updates status
- Full lifecycle: load → draft → validate → undo → redo → publish

**Test results (after fixes):**
- 13/16 passing
- 3 remaining failures were related to the validation strictness (same-semester = error) and incorrect expected import version ID

---

## 5. Remaining Work & Recommendations

### Immediate (before next test run)
1. ✅ Fix validation `>=` → `>` + warning for same-semester
2. ✅ Create DB migration for graph draft tables
3. ✅ Fix frontend type mismatches
4. ✅ Add missing API client methods

### Short-term
5. **Wire up `apiClient` in `CurriculumGraphWorkspace`** — replace raw `fetch()` calls with `apiClient.undoCurriculumGraph()`, `apiClient.redoCurriculumGraph()`, `apiClient.publishCurriculumGraph()`
6. **Add "Save Draft" button** — currently users can only undo/redo/publish; there's no way to explicitly save intermediate graph state
7. **Add suggestion rendering** — the component receives suggestions from the API but does not show them
8. **Add edge creation UI** — `ObsidianGraph` supports `onEdgeCreate`, but `CurriculumGraphWorkspace` passes a no-op
9. **Add node position persistence** — `mapDbNodeToDraft` sets `positionX: 0, positionY: 0` for all loaded nodes, losing layout

### Medium-term
10. **Graph validation after undo/redo** — the backend should validate the restored graph and reject invalid undo payloads rather than storing corrupted state
11. **Auto-save draft** — for a smooth UX, draft should auto-save on every meaningful change (node move, edge add, edge delete)
12. **Bulk suggestion application** — the suggest endpoint generates candidates but the UI doesn't show them; consider a batch approve/reject panel

---

## 6. Files Modified in This Session

| File | Change |
|------|--------|
| `air-mentor-api/src/db/migrations/0028_curriculum_graph_draft_tables.sql` | **Created** — adds `curriculum_graph_drafts`, `curriculum_graph_history`, `curriculum_graph_suggestions` |
| `air-mentor-api/src/modules/curriculum-graph-routes.ts` | Fixed validation: same-semester prerequisites are warnings, not errors |
| `src/api/client.ts` | Added 8 new graph mutation methods to interface + implementation |
| `src/curriculum-graph-workspace.tsx` | Fixed `apiNodesToGraphNodes` and `apiEdgesToGraphEdges` type mismatches |
| `air-mentor-api/tests/curriculum-graph-routes.test.ts` | **Created** — 16-test E2E suite |
| `docs/curriculum-graph-e2e-audit.md` | **Created** — this document |
