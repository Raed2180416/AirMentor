# AirMentor Target Architecture

**Date:** 2026-06-05
**Scope:** Full-stack refactor from MSRUAS-specific monolith to university-agnostic Clean Architecture
**Constraint:** Zero rewrites. Incremental extraction preserving all domain logic.

---

## 1. Current State Diagnosis

### 1.1 Scale & Complexity
| Metric | Value | Interpretation |
|---|---|---|
| Files | 11,916 | Includes untracked scratch scripts (~40%) |
| Functions | 14,459 | Very high for a single-developer codebase |
| Dead Code | 22.3% | 231 dead symbols, 6 dead UI files |
| Modularity Score | 0.508 | Below 0.6 = high coupling |
| Cross-cluster edges | 1,136 | High inter-module entanglement |

### 1.2 Architectural Overlay (ctxo)
The CTXO layer detector returned **zero Domain-layer files**. All files fell into Unknown, Infrastructure, Configuration, Composition, or Test. There is no domain layer.

### 1.3 Complexity Hotspots
| Symbol | Cyclomatic | File |
|---|---|---|
| `system-admin-live-app.tsx` | 1,508 | `src/system-admin-live-app.tsx` |
| `OperationalWorkspace` | 696 | `src/App.tsx` |
| `buildHodProofAnalytics` | 585 | `proof-control-plane-hod-service.ts` |
| `buildAcademicBootstrap` | 419 | `modules/academic.ts` |

### 1.4 Most Central Symbols (PageRank)
1. `AppDb` type — 111 inbound references (schema is the architecture)
2. `parseJson` — 107 inbound (utility god function)
3. `ResolvedPolicy` type — 41 inbound (policy scattering)
4. `RouteContext` — 59 inbound (Fastify coupling)

**Conclusion:** Database schema is the de facto architecture. Everything depends on it.

---

## 2. Target Architecture Overview

### 2.1 Principles
1. **Dependency Rule** — Inner circles know nothing of outer circles
2. **Screaming Architecture** — Folders say `curriculum/`, `grading/`, not `controllers/`
3. **Policy over Detail** — MSRUAS is one policy implementation
4. **Simulation != Production** — Proof/demo is physically isolated
5. **Feature Contract Governance** — Every ML feature has a canonical definition
6. **No file over 400 lines** — Complexity must be organizational

### 2.2 Concentric Layers
```
Frameworks & Drivers (outer)
  Fastify, React, Drizzle, PostgreSQL, Playwright
Interface Adapters
  Controllers, Repositories, Presenters, Gateways
Application Services (Use Cases)
  Orchestrate domain objects for workflows
Domain (inner) — ZERO external dependencies
  Entities, Value Objects, Domain Services, Policies
```

### 2.3 Top-Level Structure
```
air-mentor/
├── kernel/                    # University-agnostic domain (pure TS)
│   ├── identity/
│   ├── curriculum/
│   ├── grading/
│   ├── credit/
│   ├── policy/
│   ├── assessment/
│   ├── risk/
│   └── ml/
├── adapters/                  # Framework glue
│   ├── persistence/           # Drizzle repositories
│   ├── http/                  # Fastify controllers
│   ├── web/                   # React UI
│   ├── simulation/            # Proof/demo UI
│   └── ml-runtime/            # Python bridge
├── universities/              # Per-university plugins
│   └── msruas/
├── scripts/
│   ├── ml/
│   └── ops/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── contracts/
└── docs/architecture/
```

---

## 3. Domain Layer (kernel/)

### 3.1 identity/
Value objects with zero framework dependencies:
```typescript
interface Student {
  readonly id: StudentId
  readonly institutionId: InstitutionId
  readonly usn: string
  readonly name: string
}

type RoleCode = 'HOD' | 'MENTOR' | 'COURSE_LEADER' | 'SYSADMIN'

interface RoleGrant {
  readonly grantId: string
  readonly facultyId: FacultyId
  readonly roleCode: RoleCode
  readonly scopeType: 'department' | 'batch' | 'offering'
  readonly scopeId: string
}
```

### 3.2 curriculum/
```typescript
interface CourseDefinition {
  readonly code: CourseCode
  readonly title: string
  readonly credits: CreditCount
  readonly departmentId: DepartmentId
  readonly assessmentTemplate: AssessmentTemplate
}

interface PrerequisiteGraph {
  readonly nodes: ReadonlySet<CourseCode>
  readonly edges: ReadonlyArray<{
    source: CourseCode
    target: CourseCode
    kind: 'prerequisite' | 'corequisite' | 'bridge'
    weight: number
  }>
}
```

### 3.3 grading/
**Critical extraction.** Currently `msruas-rules.ts` is imported by 41 files. Target:
```typescript
interface GradingEngine {
  readonly gradingSystem: GradingSystem
  calculateSgpa(attempts: SemesterAttempt[], rules: SgpaCgpaRules): SgpaResult
  calculateCgpa(semesters: SemesterAttempt[], rules: SgpaCgpaRules): CgpaResult
  evaluateCourseStatus(evidence: CourseEvidence, rules: PassRules): CourseStatusDecision
}

interface GradingSystem {
  readonly gradeBands: GradeBand[]
  readonly passThreshold: Percentage
  readonly gradePointMapping: ReadonlyMap<string, number>
}

interface PassRules {
  readonly ceMinimum: Percentage
  readonly seeMinimum: Percentage
  readonly overallMinimum: Percentage
  readonly ceWeight: number   // 0.60 for MSRUAS
  readonly seeWeight: number  // 0.40 for MSRUAS
}
```

MSRUAS implementation:
```typescript
// universities/msruas/grading/msruas-grading-system.ts
export const MSRUAS_GRADING_SYSTEM: GradingSystem = {
  gradeBands: [
    { grade: 'O', minimumMark: 90, maximumMark: 100, gradePoint: 10 },
    { grade: 'A+', minimumMark: 80, maximumMark: 89, gradePoint: 9 },
    { grade: 'A', minimumMark: 70, maximumMark: 79, gradePoint: 8 },
    { grade: 'B+', minimumMark: 60, maximumMark: 69, gradePoint: 7 },
    { grade: 'B', minimumMark: 55, maximumMark: 59, gradePoint: 6 },
    { grade: 'C', minimumMark: 50, maximumMark: 54, gradePoint: 5 },
    { grade: 'P', minimumMark: 40, maximumMark: 49, gradePoint: 4 },
    { grade: 'F', minimumMark: 0, maximumMark: 39, gradePoint: 0 },
  ],
  passThreshold: { value: 40 },
  gradePointMapping: new Map([
    ['O', 10], ['A+', 9], ['A', 8], ['B+', 7],
    ['B', 6], ['C', 5], ['P', 4], ['F', 0],
  ]),
}

export const MSRUAS_PASS_RULES: PassRules = {
  ceMinimum: { value: 40 },
  seeMinimum: { value: 40 },
  overallMinimum: { value: 40 },
  ceWeight: 0.60,
  seeWeight: 0.40,
}
```

### 3.4 credit/
```typescript
interface BacklogStatus {
  readonly activeCredits: CreditCount
  readonly clearedCredits: CreditCount
  readonly totalHistoricalCredits: CreditCount
  readonly blockingCourses: CourseCode[]
}

interface PromotionEngine {
  readonly promotionRules: PromotionRules
  evaluatePromotion(history: AcademicHistory, current: SemesterAttempt): PromotionDecision
}

interface PromotionRules {
  readonly maxBacklogCreditsForPromotion: CreditCount
  readonly lowerYearBlockerEnabled: boolean
  readonly maxDegreeDurationSemesters: number
}
```

### 3.5 policy/
Currently `ResolvedPolicy` is a monolithic type imported by 41 files.
```typescript
interface PolicyEngine {
  resolvePolicy(scope: PolicyScope, overrides: PolicyOverride[]): ResolvedPolicy
  resolveStagePolicy(basePolicy: ResolvedPolicy, stage: StageKey): StagePolicy
}

interface ResolvedPolicy {
  readonly gradingSystem: GradingSystem
  readonly passRules: PassRules
  readonly promotionRules: PromotionRules
  readonly attendanceRules: AttendanceRules
  readonly condonationRules: CondonationRules
  readonly assessmentTemplate: AssessmentTemplate
  readonly version: string
}

type PolicyScope =
  | { kind: 'institution'; institutionId: InstitutionId }
  | { kind: 'department'; departmentId: DepartmentId }
  | { kind: 'batch'; batchId: BatchId }
  | { kind: 'offering'; offeringId: OfferingId }
```

### 3.6 risk/
Currently `proof-risk-model.ts` is 3,191 lines. Target decomposition:
```typescript
interface FeatureContract {
  readonly version: string  // 'observable-risk-features-v6'
  readonly features: ReadonlyArray<FeatureDefinition>
}

interface FeatureDefinition {
  readonly name: string
  readonly index: number
  readonly semanticType: 'ratio' | 'ordinal' | 'binary' | 'missingness-indicator'
  readonly stageMask: StageMask
}

interface RiskScorer {
  readonly modelArtifact: ModelArtifact
  score(features: FeatureVector, head: RiskHeadKey): RiskScore
}

interface DriverInferenceEngine {
  inferDrivers(features: FeatureVector, score: RiskScore): Driver[]
}

interface ExplanationEngine {
  generateExplanation(score: RiskScore, drivers: Driver[], model: ModelArtifact): Explanation
}
```

### 3.7 ml/ — Model Artifact Governance
```typescript
interface ModelArtifact {
  readonly id: string
  readonly version: string
  readonly featureSchemaVersion: string
  readonly supportedHeads: RiskHeadKey[]
  readonly calibrationMethod: CalibrationMethod
  readonly explanationEngineType: 'logistic-coefficients' | 'shap' | 'ebm'
  readonly trainedAt: Date
  readonly validatedOn: Date
}

interface ModelRegistry {
  getPrimary(head: RiskHeadKey): ModelArtifact
  getChallenger(head: RiskHeadKey): ModelArtifact | null
  validateArtifact(artifact: ModelArtifact): ValidationResult
}
```

---

## 4. Application Services

No business logic. Only orchestration.
```typescript
class AdvanceProofStage {
  constructor(
    private proofRuns: ProofRunRepository,
    private policyEngine: PolicyEngine,
    private riskScorer: RiskScorer,
    private telemetry: TelemetryEmitter
  ) {}

  async execute(input: AdvanceProofStageInput): Promise<AdvanceProofStageResult> {
    const run = await this.proofRuns.findById(input.runId)
    if (!run) throw new NotFoundError('ProofRun', input.runId)

    const policy = this.policyEngine.resolvePolicy(
      { kind: 'batch', batchId: run.batchId }, []
    )

    const nextState = run.advanceToStage(input.targetStage, policy)
    const risk = this.riskScorer.score(nextState.featureVector, 'overallCourseRisk')

    await this.proofRuns.save(nextState)
    this.telemetry.emit('proof.stage.advanced', { runId: input.runId })

    return { run: nextState, risk }
  }
}
```

Repository interfaces (defined in application, implemented in adapters):
```typescript
interface ProofRunRepository {
  findById(id: SimulationRunId): Promise<ProofRun | null>
  findActiveForBatch(batchId: BatchId): Promise<ProofRun | null>
  save(run: ProofRun): Promise<void>
}

interface StudentRepository {
  findById(id: StudentId): Promise<Student | null>
  findEnrolledInBatch(batchId: BatchId): Promise<Student[]>
}
```

---

## 5. Adapter Layer

### 5.1 persistence/
**Rule:** Drizzle schema is ONLY referenced here. No other layer imports `db/schema.ts`.
```typescript
class DrizzleProofRunRepository implements ProofRunRepository {
  constructor(private db: AppDb) {}

  async findById(id: SimulationRunId): Promise<ProofRun | null> {
    const row = await this.db.query.simulationRuns.findFirst({
      where: eq(simulationRuns.simulationRunId, id.value)
    })
    if (!row) return null
    return this.toDomain(row)
  }

  private toDomain(row: SimulationRunRow): ProofRun {
    // Single conversion point
  }
}
```

### 5.2 http/
Controller knows HTTP. Nothing else.
```typescript
function registerProofRoutes(app: FastifyInstance, context: HttpContext) {
  app.post('/api/proof/runs/:runId/advance', async (request, reply) => {
    const useCase = context.resolve(AdvanceProofStage)
    const result = await useCase.execute({
      runId: SimulationRunId(request.params.runId),
      targetStage: parseStageKey(request.body.targetStage)
    })
    reply.status(200).send(ProofRunPresenter.toJson(result.run))
  })
}
```

### 5.3 web/
```
adapters/web/
├── app/                     # Shell, routing, providers
├── features/
│   ├── curriculum/
│   ├── risk/
│   ├── faculty/
│   └── admin/
├── shared/
│   ├── components/
│   └── hooks/
└── simulation/              # Proof/demo UI
```

**State rules:**
- Server state -> React Query
- Client state -> Zustand per feature
- `App.tsx` is only `<Providers><Router /></Providers>`

### 5.4 ml-runtime/
```typescript
class PythonMlRuntime implements MlScorerPort {
  constructor(
    private artifactPath: string,
    private featureContract: FeatureContract
  ) {}

  async score(features: FeatureVector, head: RiskHeadKey): Promise<RiskScore> {
    // Validate feature schema version before scoring
    // Spawn Python or call HTTP service
  }
}
```

---

## 6. University Plugins

```
universities/
├── msruas/
│   ├── curriculum/
│   │   └── mnc-2023-curriculum.json
│   ├── policy/
│   │   ├── msruas-grading-system.ts
│   │   ├── msruas-pass-rules.ts
│   │   ├── msruas-promotion-rules.ts
│   │   └── msruas-assessment-template.ts
│   ├── validation/
│   │   └── canonical-test-cases.ts
│   └── seeding/
│       └── msruas-proof-sandbox.ts
└── iitb/                      # Future
```

Plugin registration:
```typescript
export const msruasPlugin: UniversityPlugin = {
  id: 'msruas',
  gradingSystem: MSRUAS_GRADING_SYSTEM,
  passRules: MSRUAS_PASS_RULES,
  promotionRules: MSRUAS_PROMOTION_RULES,
  assessmentTemplate: MSRUAS_ASSESSMENT_TEMPLATE,
  curriculumLoader: loadMnc2023Curriculum,
  validationFixtures: MSRUAS_CANONICAL_TEST_CASES,
}
```

---

## 7. Data Flow

### 7.1 Live Production
```
Faculty enters marks
    |
    v
[http controller]
    |
    v
[use case: commit-assessment-entries]
    |
    v
[kernel/grading/grading-engine] --> SGPA, pass/fail
    |
    v
[kernel/credit/promotion-engine] --> backlog, promotion
    |
    v
[kernel/risk/feature-computer] --> FeatureVector v6
    |
    v
[kernel/risk/risk-scorer] --> risk heads
    |
    v
[kernel/risk/driver-inference] --> drivers
    |
    v
[use case: update-action-queue]
    |
    v
[persistence repository]
    |
    v
Faculty sees updated queue
```

### 7.2 Proof Simulation
```
Sysadmin clicks "Next Stage"
    |
    v
[http controller]
    |
    v
[use case: advance-proof-stage]
    |
    v
[kernel/policy/policy-engine]
    |
    v
[kernel/assessment/semester-simulator]
    |
    v
[kernel/risk/feature-computer]  # SAME as production
    |
    v
[kernel/risk/risk-scorer]         # SAME as production
    |
    v
[simulation playback assembler]
    |
    v
UI renders
```

**Production and simulation MUST use the same `FeatureComputer` and `RiskScorer`.**

---

## 8. Security Architecture

### 8.1 Authentication
- OAuth 2.0 / OIDC for production (mark current session+CSRF as `demo-only`)
- bcrypt password hashing (keep current)

### 8.2 Authorization
```typescript
interface AuthorizationPolicy {
  canViewStudent(faculty: Faculty, student: Student, context: ViewContext): boolean
  canModifyMarks(faculty: Faculty, offering: CourseOffering): boolean
  canConfigurePolicy(faculty: Faculty, scope: PolicyScope): boolean
  canRunSimulation(faculty: Faculty): boolean
}
```

### 8.3 Data Privacy
- Student PII pseudonymized in logs
- Synthetic data generator NEVER embeds real identifiers
- GDPR deletion: cascade purge inference artifacts on student removal
- ML training exports anonymized

---

## 9. ML Pipeline

### 9.1 Training-Serving Alignment
**Current problems:**
- Python generator uses 40/60 CE/SEE; MSRUAS is 60/40
- Python updates CGPA before writing rows; TS does it after
- Python uses subject-count backlog; TS uses credit-based
- `feat_25` mapping mismatch

**Target:**
```
single-source-of-truth/
└── feature-computer/
    ├── typescript/
    │   └── feature-computer.ts
    ├── python/
    │   └── feature_computer.py
    └── contract-tests/
        └── feature-contract.test.ts
```

### 9.2 Model Governance
Current state: `deployAllowed: false`, `deploymentStatus: shadow_only`. This is CORRECT. Do NOT change until all gates pass.

### 9.3 Feature Schema Versioning
Every artifact MUST include:
- `featureSchemaVersion`: `'observable-risk-features-v6'`
- `featureIndices`: `['feat_0', ..., 'feat_47']`
- `featureDefinitions`: Array of `FeatureDefinition`

Mismatched version -> refuse to serve.

---

## 10. Testing Architecture

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | Pure domain (no DB, no HTTP) |
| Integration | Vitest + testcontainers | Repositories, controllers |
| Contract | Vitest + Python | Feature computation TS/Python parity |
| E2E | Playwright | Full flows |

### Critical Contract Test
```typescript
import { computeFeatureVector } from '../../kernel/risk/feature-computer'
import { MSRUAS_CANONICAL_CASES } from '../../universities/msruas/validation/canonical-test-cases'

describe('Feature Contract v6', () => {
  for (const testCase of MSRUAS_CANONICAL_CASES) {
    it(`computes correct features for ${testCase.name}`, () => {
      const result = computeFeatureVector(testCase.input)
      expect(result.toArray()).toEqual(testCase.expectedFeatures)
    })
  }
})
```

---

## 11. Migration Path (8 Weeks)

### Phase 1: Establish Boundaries (Week 1-2)
1. Create `kernel/` directory
2. Extract `msruas-rules.ts` types into `kernel/grading/`
3. Create `GradingEngine` interface; implement `MsruasGradingEngine`
4. Add ESLint: `kernel/` may not import from `adapters/`, `modules/`, `db/`
5. Do NOT refactor callers yet

### Phase 2: Decompose proof-risk-model.ts (Week 2-4)
1. Extract `FeatureContract` into `kernel/risk/feature-contract.ts`
2. Extract `RiskScorer` interface
3. Extract `DriverInferenceEngine` interface
4. Move CatBoost loading into `adapters/ml-runtime/`
5. Add feature contract tests

### Phase 3: Repository Extraction (Week 3-5)
1. Define repository interfaces in `application/ports/`
2. Implement `DrizzleProofRunRepository`
3. Replace direct DB access in ONE route module at a time

### Phase 4: UI Decomposition (Week 4-6)
1. Move `system-admin-live-app.tsx` into `adapters/web/features/admin/`
2. Extract Zustand stores: `useCurriculumStore`, `useRiskStore`, `useFacultyStore`
3. Replace prop drilling with store hooks
4. Hard limit: 400 lines per file

### Phase 5: University Plugin System (Week 5-7)
1. Move MSRUAS-specific code into `universities/msruas/`
2. Create `UniversityPlugin` registry
3. Add `IITB` stub to prove generality
4. Parameterize all hardcoded MSRUAS values

### Phase 6: Security & Observability (Week 6-8)
1. Implement `AuthorizationPolicy` interface
2. Add structured telemetry to all scoring paths
3. Add PII pseudonymization
4. Load testing with k6

---

## 12. Enforcement Strategy

### ESLint Boundaries
```js
module.exports = {
  overrides: [
    {
      files: ['kernel/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          patterns: [
            { group: ['**/adapters/**'], message: 'Kernel cannot import from adapters' },
            { group: ['**/db/**'], message: 'Kernel cannot import from db' },
            { group: ['fastify'], message: 'Kernel cannot import Fastify' },
            { group: ['drizzle-orm'], message: 'Kernel cannot import Drizzle' },
            { group: ['react'], message: 'Kernel cannot import React' },
          ]
        }]
      }
    }
  ]
}
```

### Build Validation
```bash
npx tsc -p kernel/tsconfig.json --noEmit   # Must pass with NO external deps
npx tsc -p adapters/tsconfig.json --noEmit # Can have deps
```

### Architectural Fitness Functions
```typescript
// tests/architecture/layer-boundaries.test.ts
import { parseSourceFile, extractImports } from 'ts-morph'

describe('Dependency Rule', () => {
  it('kernel never imports from adapters', () => {
    const kernelFiles = glob('kernel/**/*.ts')
    for (const file of kernelFiles) {
      const imports = extractImports(file)
      const violations = imports.filter(i => i.includes('/adapters/'))
      expect(violations).toEqual([])
    }
  })

  it('no file exceeds 400 lines', () => {
    const sourceFiles = glob('src/**/*.ts')
    const offenders = sourceFiles.filter(f => lineCount(f) > 400)
    expect(offenders).toEqual([])
  })
})
```

---

## 13. Big Company Code Reality Check

### Is FAANG code cleaner?
**Not really. It's differently messy.**

| Dimension | Your Codebase | Big Company Code |
|---|---|---|
| **Local complexity** | Very high (1,508 cc files) | Lower per file, but 10,000-line god classes exist |
| **Organizational complexity** | Low (you own everything) | High (team boundaries, ownership) |
| **Legacy** | Months old | 10-20 years old, nobody dares touch |
| **Politics** | None | Code reflects org chart; 3 logging libraries because 3 teams |
| **Bureaucracy** | Fast iteration | Changing a constant requires 4 code reviews |
| **Observability** | Basic telemetry | Comprehensive metrics, tracing, SLOs |
| **Testing** | Good coverage | Extensive, but often slow and flaky |

**Your competitive advantage:** You understand the domain deeply. Big companies have cleaner boundaries but worse domain knowledge due to team turnover.

**The real task:** Move complexity from local (giant files) to organizational (clear boundaries). This is easier than fighting legacy politics.

---

## 14. Summary — What to Do Monday Morning

1. **Create `kernel/grading/`** and move `GradeBand`, `PassRules`, `SgpaCgpaRules` types there
2. **Add one ESLint rule** forbidding `kernel/` from importing `db/`
3. **Pick the worst file** (`system-admin-live-app.tsx`) and extract ONE panel component into `adapters/web/features/admin/`
4. **Write ONE contract test** for feature computation parity
5. **Do not rewrite anything.** Extract on contact.
