import { StudentEditorModals } from './student-editor-modals'
import { FacultyEditorModals } from './faculty-editor-modals'
import { HierarchyEditorModals } from './hierarchy-editor-modals'
import type { EntityEditorModalsProps } from './entity-editor-modal-types'

export type { EntityEditorModalsProps } from './entity-editor-modal-types'

/**
 * Compatibility facade for focused editor surfaces. The live admin shell owns
 * state and mutation handlers; each renderer owns only one record family.
 */
export function EntityEditorModals(props: EntityEditorModalsProps) {
  return (
    <>
      <StudentEditorModals {...props} />
      <FacultyEditorModals {...props} />
      <HierarchyEditorModals {...props} />
    </>
  )
}
