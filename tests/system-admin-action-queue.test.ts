import { describe, expect, it } from 'vitest'
import {
  collectAdminQueueDismissKeys,
  mergeAdminQueueDismissKeys,
} from '../src/system-admin-action-queue'

describe('system-admin action queue helpers', () => {
  it('collects request, reminder, and hidden-item dismiss keys for bulk hide', () => {
    expect(collectAdminQueueDismissKeys({
      requestIds: ['req_1'],
      reminderIds: ['rem_2'],
      hiddenItemKeys: ['archived:faculty_3'],
    })).toEqual([
      'request:req_1',
      'reminder:rem_2',
      'hidden:archived:faculty_3',
    ])
  })

  it('merges bulk dismiss keys without duplicating existing hidden items', () => {
    expect(mergeAdminQueueDismissKeys(
      ['request:req_1', 'hidden:archived:faculty_3'],
      ['request:req_1', 'reminder:rem_2', 'hidden:archived:faculty_3'],
    )).toEqual([
      'request:req_1',
      'hidden:archived:faculty_3',
      'reminder:rem_2',
    ])
  })
})
