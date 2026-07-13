import { Building2, GraduationCap, Layers3, Shield, UserCog } from 'lucide-react'
import type { AdminSectionId } from './types'

export const TOP_TABS: Array<{ id: AdminSectionId; label: string; icon: typeof Building2 }> = [
  { id: 'overview', label: 'Overview', icon: Layers3 },
  { id: 'proof-dashboard', label: 'Proof', icon: Layers3 },
  { id: 'faculties', label: 'Faculties', icon: Building2 },
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'faculty-members', label: 'Faculty Members', icon: UserCog },
  { id: 'requests', label: 'Requests', icon: Shield },
]

export const WEEKDAYS_6 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const WEEKDAYS_7 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
