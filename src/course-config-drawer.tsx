/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Settings, Clock, CheckCircle2, BookMarked, GraduationCap } from 'lucide-react'
import { T, mono, sora } from './data'
import { Btn, UI_RADII, withAlpha } from './ui-primitives'

type CourseConfigDrawerProps = {
  isOpen: boolean
  onClose: () => void
  nodeData: any // using any for now, will cast properly in usage
  onUpdate: (data: any) => void
  locked: boolean
}

export function CourseConfigDrawer({ isOpen, onClose, nodeData, onUpdate, locked }: CourseConfigDrawerProps) {
  const [activeTab, setActiveTab] = useState<'identity' | 'assessments' | 'see' | 'attendance'>('identity')

  const handleChange = (key: string, value: any) => {
    onUpdate({ [key]: value })
  }

  const currentCE = 60
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: withAlpha(T.bg, 'aa'),
              backdropFilter: 'blur(4px)',
              zIndex: 100
            }}
          />
          <motion.div
            initial={{ x: '100%', opacity: 0, boxShadow: '0 0 0 rgba(0,0,0,0)' }}
            animate={{ x: 0, opacity: 1, boxShadow: '-20px 0 60px rgba(0,0,0,0.3)' }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 550,
              background: T.surface,
              borderLeft: `1px solid ${T.border}`,
              zIndex: 101,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div style={{ padding: '24px 32px', borderBottom: `1px solid ${T.border}`, background: T.surface2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ ...sora, fontSize: 20, fontWeight: 800, color: T.text }}>Course Configuration</div>
                  <div style={{ ...mono, fontSize: 12, color: T.muted, marginTop: 4 }}>
                    {nodeData.code || 'NEW101'} · {nodeData.label || 'New Course'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: T.muted, padding: 8, borderRadius: '50%' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = withAlpha(T.text, '11'))}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 24, marginTop: 24, borderBottom: `1px solid ${T.border}` }}>
                <TabButton active={activeTab === 'identity'} onClick={() => setActiveTab('identity')} icon={<BookMarked size={14} />} label="Identity" />
                <TabButton active={activeTab === 'assessments'} onClick={() => setActiveTab('assessments')} icon={<CheckCircle2 size={14} />} label="CE (Internal)" />
                <TabButton active={activeTab === 'see'} onClick={() => setActiveTab('see')} icon={<GraduationCap size={14} />} label="SEE (External)" />
                <TabButton active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={<Clock size={14} />} label="Attendance" />
              </div>
            </div>

            {/* Content Body */}
            <div style={{ padding: '32px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {activeTab === 'identity' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <FormSection title="Core Identification">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
                      <FormInput label="Course Code" value={nodeData.code || ''} onChange={(v) => handleChange('code', v)} disabled={locked} />
                      <FormInput label="Title" value={nodeData.label || ''} onChange={(v) => handleChange('label', v)} disabled={locked} />
                    </div>
                  </FormSection>

                  <FormSection title="Governance & Types">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <FormSelect 
                        label="Course Type" 
                        value={nodeData.courseType || 'core'} 
                        onChange={(v) => handleChange('courseType', v)} disabled={locked}
                        options={[{value: 'core', label: 'Core'}, {value: 'elective', label: 'Elective'}, {value: 'bridge', label: 'Bridge'}, {value: 'project', label: 'Project'}]}
                      />
                      <FormSelect 
                        label="Grading Scheme" 
                        value={nodeData.gradingScheme || 'absolute'} 
                        onChange={(v) => handleChange('gradingScheme', v)} disabled={locked}
                        options={[{value: 'absolute', label: 'Absolute'}, {value: 'relative', label: 'Relative'}, {value: 'mixed', label: 'Mixed'}]}
                      />
                    </div>
                  </FormSection>

                  <FormSection title="Credits & Load">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      <FormInput type="number" label="Total Credits" value={nodeData.credits || 3} onChange={(v) => handleChange('credits', Number(v))} disabled={locked} />
                      <FormInput type="number" label="Theory Credits" value={nodeData.theoryCredits || 3} onChange={(v) => handleChange('theoryCredits', Number(v))} disabled={locked} />
                      <FormInput type="number" label="Lab Credits" value={nodeData.labCredits || 0} onChange={(v) => handleChange('labCredits', Number(v))} disabled={locked} />
                    </div>
                  </FormSection>
                </motion.div>
              )}

              {activeTab === 'assessments' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: withAlpha(T.accent, '10'), borderRadius: UI_RADII.card, border: `1px solid ${withAlpha(T.accent, '30')}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Settings size={18} color={T.accent} />
                      <div>
                        <div style={{ ...sora, fontSize: 13, fontWeight: 700, color: T.text }}>CE Aggregation (Auto-calculated)</div>
                        <div style={{ ...mono, fontSize: 11, color: T.muted }}>Total marks must equal 60</div>
                      </div>
                    </div>
                    <div style={{ ...sora, fontSize: 18, fontWeight: 800, color: currentCE > 60 ? T.danger : T.accent }}>
                      {currentCE} <span style={{ fontSize: 13, color: T.muted }}>/ 60</span>
                    </div>
                  </div>

                  <FormSection title="Term Tests (TT)">
                    <FormSelect 
                      label="Number of Term Tests" 
                      value={nodeData.ttCount ?? 2} 
                      onChange={(v) => handleChange('ttCount', Number(v))} disabled={locked}
                      options={[{value: '1', label: '1 Term Test'}, {value: '2', label: '2 Term Tests'}]}
                    />
                  </FormSection>

                  <FormSection title="Quizzes & Assignments">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <FormSelect 
                        label="Number of Quizzes" 
                        value={nodeData.quizCount ?? 2} 
                        onChange={(v) => handleChange('quizCount', Number(v))} disabled={locked}
                        options={[0,1,2,3,4,5].map(n => ({value: n.toString(), label: `${n} Quizzes`}))}
                      />
                      <FormSelect 
                        label="Number of Assignments" 
                        value={nodeData.assignmentCount ?? 1} 
                        onChange={(v) => handleChange('assignmentCount', Number(v))} disabled={locked}
                        options={[0,1,2,3,4,5].map(n => ({value: n.toString(), label: `${n} Assignments`}))}
                      />
                    </div>
                  </FormSection>

                  <FormSection title="Labs & Practicals">
                    <FormSelect 
                      label="Number of Lab Sessions" 
                      value={nodeData.labCount ?? 0} 
                      onChange={(v) => handleChange('labCount', Number(v))} disabled={locked}
                      options={[0,1,2,3,4,5,6,7,8,9,10,11,12].map(n => ({value: n.toString(), label: `${n} Sessions`}))}
                    />
                  </FormSection>
                </motion.div>
              )}

              {activeTab === 'see' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <FormSection title="Semester End Examination (SEE)">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <FormInput type="number" label="Max Marks" value={nodeData.seeMaxMarks || 60} onChange={(v) => handleChange('seeMaxMarks', Number(v))} disabled={locked} />
                      <FormInput type="number" label="Min Pass Marks (40%)" value={nodeData.seeMinPassMarks || 24} onChange={(v) => handleChange('seeMinPassMarks', Number(v))} disabled={locked} />
                    </div>
                  </FormSection>

                  <FormSection title="Format & Logistics">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <FormInput type="number" label="Duration (Hours)" value={nodeData.seeDurationHours || 3} onChange={(v) => handleChange('seeDurationHours', Number(v))} disabled={locked} />
                      <FormSelect 
                        label="Pattern" 
                        value={nodeData.seePattern || 'subjective'} 
                        onChange={(v) => handleChange('seePattern', v)} disabled={locked}
                        options={[{value: 'subjective', label: 'Subjective'}, {value: 'objective', label: 'Objective'}, {value: 'mixed', label: 'Mixed'}]}
                      />
                      <FormSelect 
                        label="Type" 
                        value={nodeData.seeType || 'written'} 
                        onChange={(v) => handleChange('seeType', v)} disabled={locked}
                        options={[{value: 'written', label: 'Written'}, {value: 'practical', label: 'Practical'}, {value: 'viva', label: 'Viva'}, {value: 'mixed', label: 'Mixed'}]}
                      />
                      <FormSelect 
                        label="Backlog Students Allowed" 
                        value={nodeData.seeBacklogAllowed !== false ? 'true' : 'false'} 
                        onChange={(v) => handleChange('seeBacklogAllowed', v === 'true')} disabled={locked}
                        options={[{value: 'true', label: 'Yes'}, {value: 'false', label: 'No'}]}
                      />
                    </div>
                  </FormSection>
                </motion.div>
              )}

              {activeTab === 'attendance' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <FormSection title="Attendance Requirements">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <FormInput type="number" label="Min Attendance %" value={nodeData.attendanceMinPct || 75} onChange={(v) => handleChange('attendanceMinPct', Number(v))} disabled={locked} />
                      <FormInput type="number" label="Grace Buffer %" value={nodeData.attendanceGracePct || 5} onChange={(v) => handleChange('attendanceGracePct', Number(v))} disabled={locked} />
                    </div>
                  </FormSection>

                  <FormSection title="Medical & Exemptions">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <FormSelect 
                        label="Medical Exemption Allowed" 
                        value={nodeData.medicalExemptionAllowed !== false ? 'true' : 'false'} 
                        onChange={(v) => handleChange('medicalExemptionAllowed', v === 'true')} disabled={locked}
                        options={[{value: 'true', label: 'Yes'}, {value: 'false', label: 'No'}]}
                      />
                      <FormInput type="number" label="Max Medical Days" value={nodeData.maxMedicalDays || 10} onChange={(v) => handleChange('maxMedicalDays', Number(v))} disabled={locked} />
                    </div>
                  </FormSection>

                  <FormSection title="Penalty Policy">
                    <FormSelect 
                      label="Penalty for Low Attendance" 
                      value={nodeData.attendancePenaltyPolicy || 'see_ineligible'} 
                      onChange={(v) => handleChange('attendancePenaltyPolicy', v)} disabled={locked}
                      options={[
                        {value: 'see_ineligible', label: 'Ineligible for SEE'}, 
                        {value: 'grade_reduction', label: 'Grade Reduction'}, 
                        {value: 'both', label: 'Both Ineligible & Reduction'},
                        {value: 'none', label: 'No Penalty'}
                      ]}
                    />
                  </FormSection>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 32px', borderTop: `1px solid ${T.border}`, background: T.surface2, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Btn size="md" variant="ghost" onClick={onClose}>Dismiss</Btn>
              <Btn size="md" onClick={onClose}>Save Configuration</Btn>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '0 0 12px 0',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
        color: active ? T.text : T.muted,
        ...sora,
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        marginBottom: -1,
      }}
    >
      <span style={{ color: active ? T.accent : T.muted }}>{icon}</span>
      {label}
      {active && (
        <motion.div
          layoutId="activeTabIndicator"
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: T.accent, borderRadius: '2px 2px 0 0' }}
        />
      )}
    </button>
  )
}

function FormSection({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...sora, fontSize: 14, fontWeight: 700, color: T.text }}>{title}</div>
      {children}
    </div>
  )
}

function FormInput({ label, value, onChange, disabled, type = 'text' }: { label: string, value: string | number, onChange: (v: string) => void, disabled?: boolean, type?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ ...mono, fontSize: 11, color: T.muted }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          background: T.surface,
          color: T.text,
          ...mono,
          fontSize: 13,
          outline: 'none',
        }}
        onFocus={(e) => e.target.style.borderColor = T.accent}
        onBlur={(e) => e.target.style.borderColor = T.border}
      />
    </div>
  )
}

function FormSelect({ label, value, onChange, disabled, options }: { label: string, value: string, onChange: (v: string) => void, disabled?: boolean, options: {value: string, label: string}[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ ...mono, fontSize: 11, color: T.muted }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          padding: '10px 12px',
          borderRadius: 8,
          border: `1px solid ${T.border}`,
          background: T.surface,
          color: T.text,
          ...mono,
          fontSize: 13,
          outline: 'none',
          appearance: 'none',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}
