import { Data } from 'effect'

// Auth errors
export class NoPinSetError extends Data.TaggedError('NoPinSetError') {}

export class IncorrectPinError extends Data.TaggedError('IncorrectPinError') {}

export class SettingsAlreadyInitializedError extends Data.TaggedError(
  'SettingsAlreadyInitializedError'
) {}

// Resource not found errors
export class SettingsNotFoundError extends Data.TaggedError('SettingsNotFoundError') {}

export class ChildNotFoundError extends Data.TaggedError('ChildNotFoundError')<{
  childId: string
}> {}

export class TemplateNotFoundError extends Data.TaggedError('TemplateNotFoundError')<{
  templateId: string
}> {}

export class ScheduledChoreNotFoundError extends Data.TaggedError('ScheduledChoreNotFoundError')<{
  scheduleId: string
}> {}

export class ChoreInstanceNotFoundError extends Data.TaggedError('ChoreInstanceNotFoundError')<{
  instanceId: string
}> {}

export class ParticipantNotFoundError extends Data.TaggedError('ParticipantNotFoundError')<{
  childId: string
  instanceId: string
}> {}

// Validation errors
export class AccessCodeGenerationError extends Data.TaggedError('AccessCodeGenerationError') {}

export class InsufficientBalanceError extends Data.TaggedError('InsufficientBalanceError')<{
  balance: number
  requested: number
}> {}

export class NegativeBalanceError extends Data.TaggedError('NegativeBalanceError') {}

export class InvalidAmountError extends Data.TaggedError('InvalidAmountError')<{
  amount: number
}> {}

// Business logic errors
export class TemplateInUseError extends Data.TaggedError('TemplateInUseError')<{
  templateId: string
  scheduleCount: number
}> {}

export class JoinedChoreRequiresMultipleChildrenError extends Data.TaggedError(
  'JoinedChoreRequiresMultipleChildrenError'
) {}

export class ChoreNotPendingError extends Data.TaggedError('ChoreNotPendingError')<{
  instanceId: string
  status: string
}> {}

export class ChoreAlreadyDoneError extends Data.TaggedError('ChoreAlreadyDoneError')<{
  childId: string
  instanceId: string
}> {}

export class ChoreNotDoneError extends Data.TaggedError('ChoreNotDoneError')<{
  childId: string
  instanceId: string
}> {}

export class ParticipantAlreadyRatedError extends Data.TaggedError('ParticipantAlreadyRatedError')<{
  childId: string
  instanceId: string
}> {}

export class EffortPercentTotalError extends Data.TaggedError('EffortPercentTotalError')<{
  total: number
}> {}

export class NotJoinedChoreError extends Data.TaggedError('NotJoinedChoreError')<{
  instanceId: string
}> {}

export class NotAllParticipantsDoneError extends Data.TaggedError('NotAllParticipantsDoneError')<{
  instanceId: string
  doneCount: number
  totalCount: number
}> {}

// Optional chore errors
export class ChoreNotOptionalError extends Data.TaggedError('ChoreNotOptionalError')<{
  scheduleId: string
}> {}

export class ChoreNotActiveError extends Data.TaggedError('ChoreNotActiveError')<{
  scheduleId: string
}> {}

export class ChoreNotYetAvailableError extends Data.TaggedError('ChoreNotYetAvailableError')<{
  scheduleId: string
  startDate: string
}> {}

export class ChoreNoLongerAvailableError extends Data.TaggedError('ChoreNoLongerAvailableError')<{
  scheduleId: string
  endDate: string
}> {}

export class PickupLimitReachedError extends Data.TaggedError('PickupLimitReachedError')<{
  scheduleId: string
  limit: number
}> {}

export class DailyChoresNotCompleteError extends Data.TaggedError('DailyChoresNotCompleteError')<{
  choreName: string
}> {}
