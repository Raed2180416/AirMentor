# Domain Model And API Contracts

## Purpose

This document defines the backend-facing model needed to replace seeded mock state with persisted entities and stable contracts.

The goal is not to freeze implementation details such as database vendor or GraphQL versus REST. The goal is to freeze the domain language, required fields, and payload expectations.

## Core Domain Entities

## Identity And Governance

### FacultyAccount

Required fields:

- `facultyId`
- `employeeCode`
- `name`
- `email`
- `departmentCode`
- `status`
- `createdAt`
- `updatedAt`

### FacultyRoleMembership

Required fields:

- `membershipId`
- `facultyId`
- `role`
- `scopeType`
- `scopeId`
- `active`
- `effectiveFrom`
- `effectiveTo`

Examples:

- Course Leader membership scoped to a course offering
- Mentor membership scoped to a student assignment
- HoD membership scoped to the department

### Program

Required fields:

- `programId`
- `code`
- `name`
- `departmentCode`
- `active`

### MentorAssignment

Required fields:

- `assignmentId`
- `studentId`
- `mentorFacultyId`
- `effectiveFrom`
- `effectiveTo`
- `active`

Invariant:

- exactly one active primary mentor per student in v1

## Student And Academic Structure

### Student

Required fields:

- `studentId`
- `usn`
- `name`
- `programId`
- `departmentCode`
- `currentSemesterNumber`
- `currentSection`
- `status`

### Course

Required fields:

- `courseId`
- `courseCode`
- `title`
- `credits`
- `programId`
- `departmentCode`

### CourseOffering

Required fields:

- `offeringId`
- `courseId`
- `academicYear`
- `termLabel`
- `semesterNumber`
- `section`
- `programId`
- `departmentCode`
- `courseLeaderFacultyId`
- `schemeLocked`
- `schemeLockedAt`

### EvaluationScheme

Required fields:

- `evaluationSchemeId`
- `offeringId`
- `tt1RawMax`
- `tt2RawMax`
- `ttNormalizedWeight`
- `quizCount`
- `assignmentCount`
- `quizWeightTotal`
- `assignmentWeightTotal`
- `seeRawMax`
- `ceWeightTotal`
- `seeWeightTotal`
- `firstEntryStartedAt`
- `lockedAt`

Invariants:

- `tt1RawMax = 25`
- `tt2RawMax = 25`
- `ttNormalizedWeight = 30`
- `ceWeightTotal = 60`
- `seeWeightTotal = 40`
- `quizWeightTotal + assignmentWeightTotal = 30`
- `seeRawMax` is either `50` or `100`
- scheme is editable only when `firstEntryStartedAt` is null

### AssessmentComponent

Required fields:

- `componentId`
- `evaluationSchemeId`
- `componentType`
- `displayName`
- `sequenceNumber`
- `rawMax`
- `normalizedWeight`
- `active`

Allowed `componentType` values:

- `TT1`
- `TT2`
- `QUIZ`
- `ASSIGNMENT`
- `SEE`

## Entry And Locking

### MarksEntryRecord

Required fields:

- `entryRecordId`
- `offeringId`
- `studentId`
- `componentId`
- `rawScore`
- `enteredByFacultyId`
- `enteredByRole`
- `entryStatus`
- `enteredAt`
- `updatedAt`

### LockState

Required fields:

- `lockStateId`
- `offeringId`
- `entryKind`
- `locked`
- `lockedByFacultyId`
- `lockedByRole`
- `lockedAt`
- `unlockedAt`
- `unlockReason`

Allowed `entryKind` values:

- `TT1`
- `TT2`
- `QUIZ`
- `ASSIGNMENT`
- `ATTENDANCE`
- `SEE`
- `SCHEME`

### AttendanceRecord

Required fields:

- `attendanceRecordId`
- `offeringId`
- `studentId`
- `presentCount`
- `totalClasses`
- `capturedAt`
- `capturedByFacultyId`
- `capturedByRole`

## Risk And Workflow

### RiskSnapshot

Required fields:

- `riskSnapshotId`
- `studentId`
- `offeringId`
- `riskScore`
- `riskBand`
- `computedAt`
- `inputsVersion`

Recommended fields:

- `topDrivers`
- `historyFeaturesSummary`
- `attendanceSummary`
- `academicSummary`

### QueueItem

Required fields:

- `queueItemId`
- `category`
- `sourceTrigger`
- `studentId`
- `offeringId`
- `currentStatus`
- `currentOwnerRole`
- `currentOwnerFacultyId`
- `priority`
- `createdAt`
- `updatedAt`

Recommended fields:

- `dueAt`
- `escalationReason`
- `summary`
- `latestNote`

### QueueTransition

Required fields:

- `transitionId`
- `queueItemId`
- `fromStatus`
- `toStatus`
- `fromOwnerRole`
- `toOwnerRole`
- `fromOwnerFacultyId`
- `toOwnerFacultyId`
- `performedByFacultyId`
- `performedByRole`
- `reason`
- `createdAt`

### Intervention

Required fields:

- `interventionId`
- `studentId`
- `queueItemId`
- `offeringId`
- `type`
- `note`
- `actorFacultyId`
- `actorRole`
- `createdAt`

### RemedialPlan

Required fields:

- `remedialPlanId`
- `queueItemId`
- `studentId`
- `offeringId`
- `ownerRole`
- `ownerFacultyId`
- `title`
- `dueDate`
- `status`
- `createdAt`
- `updatedAt`

### RemedialPlanStep

Required fields:

- `stepId`
- `remedialPlanId`
- `sequenceNumber`
- `label`
- `completedAt`
- `completedByFacultyId`
- `completedByRole`

## Transcript And GPA

### TranscriptTerm

Required fields:

- `transcriptTermId`
- `studentId`
- `academicYear`
- `termLabel`
- `semesterNumber`
- `sgpa`
- `cgpaAfterTerm`
- `includedCredits`

### TranscriptSubjectRecord

Required fields:

- `transcriptRecordId`
- `transcriptTermId`
- `studentId`
- `courseId`
- `courseCode`
- `courseTitle`
- `credits`
- `attemptNumber`
- `isRepeatAttempt`
- `supersedesTranscriptRecordId`
- `ceScore`
- `seeScore`
- `finalSubjectScore`
- `grade`
- `gpaPoint`
- `resultStatus`
- `includeInSgpa`
- `includeInCgpa`

## Data Movement

### ImportJob

Required fields:

- `importJobId`
- `importType`
- `uploadedByFacultyId`
- `uploadedByRole`
- `status`
- `createdAt`
- `completedAt`

Recommended fields:

- `sourceFilename`
- `rowCount`
- `successCount`
- `failureCount`
- `failureReportUrl`

Allowed `importType` values:

- `STUDENTS`
- `OFFERINGS`
- `TRANSCRIPTS`
- `ATTENDANCE`
- `MARKS`

## Contract-Ready API Shapes

## Configure Evaluation Scheme

`PUT /api/offerings/{offeringId}/evaluation-scheme`

Request:

```json
{
  "actorFacultyId": "F001",
  "actorRole": "Course Leader",
  "quizComponents": [
    { "displayName": "Quiz 1", "rawMax": 10, "normalizedWeight": 10 }
  ],
  "assignmentComponents": [
    { "displayName": "Assignment 1", "rawMax": 20, "normalizedWeight": 20 }
  ],
  "seeRawMax": 100
}
```

Validation rules:

- TT1 and TT2 are implicit fixed components and are not editable
- quiz and assignment normalized weights must sum to `30`
- `seeRawMax` must be `50` or `100`
- reject if first entry has already started unless actor is HoD performing a reset flow

## Submit Marks Entry

`POST /api/mark-entries/bulk`

Request:

```json
{
  "actorFacultyId": "F001",
  "actorRole": "Course Leader",
  "offeringId": "OFF-CS401-A-2025-ODD",
  "entryKind": "TT1",
  "entries": [
    {
      "studentId": "S001",
      "componentId": "COMP-TT1",
      "rawScore": 18
    }
  ],
  "saveMode": "draft"
}
```

Rules:

- the first successful write stamps `firstEntryStartedAt` on the scheme
- once that stamp exists, scheme edits are blocked
- `saveMode` can be `draft` or `submitAndLock`

## Raise Unlock Request

`POST /api/unlock-requests`

Request:

```json
{
  "actorFacultyId": "F001",
  "actorRole": "Course Leader",
  "offeringId": "OFF-CS401-A-2025-ODD",
  "entryKind": "TT1",
  "reason": "Question-wise entry needs correction after internal moderation"
}
```

Effects:

- create an HoD-owned queue item
- create an unlock-request record
- preserve the original lock state until approval

## Create Manual Queue Item

`POST /api/queue-items`

Request:

```json
{
  "actorFacultyId": "F010",
  "actorRole": "Mentor",
  "category": "Manual Follow-Up",
  "studentId": "S001",
  "offeringId": null,
  "summary": "Student follow-up after low SGPA trend",
  "dueAt": "2026-03-18T00:00:00Z"
}
```

## Reassign Queue Item

`POST /api/queue-items/{queueItemId}/reassign`

Request:

```json
{
  "actorFacultyId": "F010",
  "actorRole": "Mentor",
  "toOwnerRole": "HoD",
  "toOwnerFacultyId": "F100",
  "reason": "Requires supervisory unlock approval"
}
```

Rules:

- one active owner only
- reassignment creates a queue transition record
- active queue visibility must update immediately

## Record Remedial Step Progress

`POST /api/remedial-plans/{remedialPlanId}/steps/{stepId}/complete`

Request:

```json
{
  "actorFacultyId": "F010",
  "actorRole": "Mentor",
  "note": "Student completed supervised practice set"
}
```

Effects:

- mark the step complete
- update plan progress
- update linked queue item status if the plan is fully complete

## Fetch Student History

`GET /api/students/{studentId}/history?viewerRole=Mentor`

Response shape:

```json
{
  "student": {
    "studentId": "S001",
    "usn": "1MS23CS001",
    "name": "Aarav Sharma"
  },
  "historySummary": {
    "currentCgpa": 6.8,
    "backlogCount": 1,
    "repeatCount": 1
  },
  "terms": [
    {
      "semesterNumber": 1,
      "sgpa": 7.1,
      "cgpaAfterTerm": 7.1,
      "subjects": [
        {
          "courseCode": "MA101",
          "grade": "A",
          "gpaPoint": 8,
          "resultStatus": "Pass"
        }
      ]
    }
  ]
}
```

Role filtering rule:

- Mentor responses must omit raw question-wise or marks-entry detail

## Submit Transcript Import

`POST /api/import-jobs/transcripts`

Request:

```json
{
  "actorFacultyId": "F100",
  "actorRole": "HoD",
  "sourceFilename": "semester-history-2025.csv"
}
```

Follow-up:

- import parses rows
- validates identity and academic consistency
- creates or updates transcript terms and subject records
- writes a failure report for rejected rows

## Derived Views That Backend Must Own

- offering evaluation scheme summary
- final subject score and grade
- SGPA
- CGPA
- active queue count by role
- student history summary
- risk snapshot summary
