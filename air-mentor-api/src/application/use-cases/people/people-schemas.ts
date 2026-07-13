/**
 * Zod request schemas for the people (faculty master) routes. Moved verbatim
 * from modules/people.ts; the controller parses request payloads against these
 * and the scope-matching helpers read the directory-scope filter shape.
 */
import { z } from 'zod'

export const facultyCreateSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).optional().nullable(),
  employeeCode: z.string().min(1),
  displayName: z.string().min(1),
  designation: z.string().min(1),
  joinedOn: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

export const facultyPatchSchema = z.object({
  username: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  employeeCode: z.string().min(1),
  displayName: z.string().min(1),
  designation: z.string().min(1),
  joinedOn: z.string().optional().nullable(),
  status: z.string().min(1),
  version: z.number().int().positive(),
})

export const appointmentCreateSchema = z.object({
  facultyId: z.string().min(1),
  departmentId: z.string().min(1),
  branchId: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

export const appointmentPatchSchema = appointmentCreateSchema.extend({
  version: z.number().int().positive(),
})

export const roleGrantCreateSchema = z.object({
  facultyId: z.string().min(1),
  roleCode: z.enum(['SYSTEM_ADMIN', 'HOD', 'COURSE_LEADER', 'MENTOR']),
  scopeType: z.string().min(1),
  scopeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().optional().nullable(),
  status: z.string().min(1).default('active'),
})

export const roleGrantPatchSchema = roleGrantCreateSchema.extend({
  version: z.number().int().positive(),
})

export const facultyDirectoryScopeQuerySchema = z.object({
  academicFacultyId: z.string().trim().min(1).optional(),
  departmentId: z.string().trim().min(1).optional(),
  branchId: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
  sectionCode: z.string().trim().min(1).optional(),
})

// Inferred payload types — resolved here (where `z` is a value) so the
// use-cases can consume plain types without a `typeof` on a type-only import.
export type FacultyCreateBody = z.infer<typeof facultyCreateSchema>
export type FacultyPatchBody = z.infer<typeof facultyPatchSchema>
export type AppointmentCreateBody = z.infer<typeof appointmentCreateSchema>
export type AppointmentPatchBody = z.infer<typeof appointmentPatchSchema>
export type RoleGrantCreateBody = z.infer<typeof roleGrantCreateSchema>
export type RoleGrantPatchBody = z.infer<typeof roleGrantPatchSchema>
export type FacultyDirectoryScopeFilter = z.infer<typeof facultyDirectoryScopeQuerySchema>
