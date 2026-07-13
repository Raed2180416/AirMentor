export type MonthCell = {
  dateISO: string
  inCurrentMonth: boolean
}

export type TimedAgendaLayoutInput = {
  id: string
  startMinutes: number
  endMinutes: number
}

export type TimedAgendaLayoutResult<T extends TimedAgendaLayoutInput> = T & {
  lane: number
  laneCount: number
}

export type ReflowedClassRange = {
  startMinutes: number
  endMinutes: number
}
