import type { Dispatch, SetStateAction } from 'react'
import type { AirMentorApiClient } from '@web/shared/api/client'
import type { LiveAdminDataset } from '../../system-admin-live-data'

export interface ReminderHandlerDeps {
  apiClient: AirMentorApiClient
  remindersSupported: boolean
  runAction: <T>(runner: () => Promise<T>) => Promise<T | null>
  setActionError: Dispatch<SetStateAction<string>>
  setFlashMessage: Dispatch<SetStateAction<string>>
}

export function createReminderHandlers(deps: ReminderHandlerDeps) {
  const { apiClient, remindersSupported, runAction, setActionError, setFlashMessage } = deps

  const handleCreateReminder = async () => {
    if (!remindersSupported) {
      setActionError('This live backend does not expose private admin reminders yet. Deploy the latest API to enable them.')
      return
    }
    const title = window.prompt('Reminder title')
    if (!title?.trim()) return
    const body = window.prompt('Reminder note', 'Follow up with HoD / verify structure change / review pending implementation.') ?? ''
    const dueAt = window.prompt('Due date and time (YYYY-MM-DDTHH:mm)', `${new Date().toISOString().slice(0, 16)}`) ?? ''
    if (!dueAt.trim()) return
    await runAction(async () => {
      await apiClient.createAdminReminder({
        title: title.trim(),
        body: body.trim() || 'Personal admin reminder.',
        dueAt: dueAt.trim(),
        status: 'pending',
      })
      setFlashMessage('Reminder created.')
    })
  }

  const handleToggleReminderStatus = async (reminder: LiveAdminDataset['reminders'][number]) => {
    if (!remindersSupported) {
      setActionError('Private reminders are not available on this backend yet.')
      return
    }
    await runAction(async () => {
      await apiClient.updateAdminReminder(reminder.reminderId, {
        title: reminder.title,
        body: reminder.body,
        dueAt: reminder.dueAt,
        status: reminder.status === 'pending' ? 'done' : 'pending',
        version: reminder.version,
      })
      setFlashMessage(reminder.status === 'pending' ? 'Reminder completed.' : 'Reminder reopened.')
    })
  }

  return { handleCreateReminder, handleToggleReminderStatus }
}
