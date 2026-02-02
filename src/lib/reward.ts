import { QUALITY_COEFFICIENTS } from './currency'
import type { QualityRating } from './currency'

/**
 * Calculate the base reward for display purposes (before quality coefficient is applied).
 *
 * For joined chores: reward is pooled and split by effort percentage.
 * For non-joined chores: each participant gets the full reward.
 *
 * @param totalReward - Total reward in cents
 * @param numParticipants - Number of participants
 * @param isJoined - Whether the chore is a joined chore
 * @param customEffortPercent - Optional custom effort percentage (only for joined chores)
 * @returns Base reward in cents for display
 */
export function calculateBaseRewardForDisplay(
  totalReward: number,
  numParticipants: number,
  isJoined: boolean,
  customEffortPercent?: number
): number {
  if (isJoined) {
    // Joined chore: reward is pooled and split by effort
    const effortPercent = customEffortPercent ?? 100 / numParticipants
    return totalReward * (effortPercent / 100)
  } else {
    // Non-joined chore: each participant gets full reward
    return totalReward
  }
}

/**
 * Calculate the displayed reward for each quality rating.
 * This is what shows on the rating buttons.
 *
 * @param baseReward - Base reward in cents (from calculateBaseRewardForDisplay)
 * @param quality - Quality rating
 * @returns Displayed reward in cents
 */
export function calculateDisplayedRewardForQuality(
  baseReward: number,
  quality: QualityRating
): number {
  return Math.round(baseReward * QUALITY_COEFFICIENTS[quality])
}

/**
 * Calculate the actual earned reward for a participant.
 *
 * For joined chores: reward = totalReward * (effortPercent / 100) * qualityCoefficient
 * For non-joined chores: reward = totalReward * qualityCoefficient
 *
 * @param totalReward - Total reward in cents
 * @param effortPercent - Effort percentage (100 for non-joined, variable for joined)
 * @param quality - Quality rating
 * @param isJoined - Whether the chore is a joined chore
 * @returns Earned reward in cents
 */
export function calculateEarnedReward(
  totalReward: number,
  effortPercent: number,
  quality: QualityRating,
  isJoined: boolean
): number {
  const coefficient = QUALITY_COEFFICIENTS[quality]

  if (isJoined) {
    // Joined chore: reward is pooled and split by effort
    const baseReward = totalReward * (effortPercent / 100)
    return Math.round(baseReward * coefficient)
  } else {
    // Non-joined chore: each participant gets full reward
    return Math.round(totalReward * coefficient)
  }
}

/**
 * Calculate the earned reward for "Rate All" dialog.
 * This matches the calculation in the ReviewContent component.
 *
 * @param totalReward - Total reward in cents
 * @param effortPercent - Effort percentage
 * @param quality - Quality rating
 * @param isJoined - Whether the chore is a joined chore
 * @returns Earned reward in cents
 */
export function calculateRateAllEarnedReward(
  totalReward: number,
  effortPercent: number,
  quality: QualityRating,
  isJoined: boolean
): number {
  const coefficient = QUALITY_COEFFICIENTS[quality]

  if (isJoined) {
    return Math.round((totalReward * effortPercent / 100) * coefficient)
  } else {
    return Math.round(totalReward * coefficient)
  }
}

/**
 * Validate that effort percentages total 100%.
 *
 * @param efforts - Record of childId to effort percentage
 * @param tolerance - Tolerance for floating point comparison (default 0.1)
 * @returns true if efforts total 100% within tolerance
 */
export function validateEffortTotal(
  efforts: Record<string, number>,
  tolerance: number = 0.1
): boolean {
  const total = Object.values(efforts).reduce((sum, v) => sum + v, 0)
  return Math.abs(total - 100) <= tolerance
}

/**
 * Redistribute efforts when one participant's effort changes.
 * Maintains 100% total by proportionally adjusting other participants.
 *
 * @param efforts - Current effort distribution
 * @param changedId - ID of the participant whose effort changed
 * @param newValue - New effort value for the changed participant
 * @returns New effort distribution
 */
export function redistributeEfforts(
  efforts: Record<string, number>,
  changedId: string,
  newValue: number
): Record<string, number> {
  const otherIds = Object.keys(efforts).filter((id) => id !== changedId)

  if (otherIds.length === 0) {
    return { [changedId]: newValue }
  }

  const remaining = 100 - newValue
  const currentOthersTotal = otherIds.reduce((sum, id) => sum + (efforts[id] ?? 0), 0)

  const newEfforts: Record<string, number> = { [changedId]: newValue }

  if (currentOthersTotal > 0) {
    otherIds.forEach((id) => {
      newEfforts[id] = (efforts[id] / currentOthersTotal) * remaining
    })
  } else {
    const equalShare = remaining / otherIds.length
    otherIds.forEach((id) => {
      newEfforts[id] = equalShare
    })
  }

  return newEfforts
}

/**
 * Initialize equal effort distribution for participants.
 *
 * @param participantIds - Array of participant IDs
 * @returns Record of participantId to equal effort percentage
 */
export function initializeEqualEfforts(participantIds: Array<string>): Record<string, number> {
  const equalPercent = 100 / participantIds.length
  return Object.fromEntries(participantIds.map((id) => [id, equalPercent]))
}
