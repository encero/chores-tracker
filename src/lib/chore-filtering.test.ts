import { describe, expect, test } from 'vitest'

// Mock types matching the actual query return types
interface MockParticipant {
  _id: string
  choreInstanceId: string
  childId: string
  status: 'pending' | 'done'
  child?: { name: string }
}

interface MockChoreInstance {
  _id: string
  status: 'pending' | 'completed' | 'missed'
  isJoined: boolean
  participants: Array<MockParticipant>
}

// Helper to get this child's participant record from a chore
function getMyParticipant(chore: MockChoreInstance, childId: string) {
  return chore.participants.find((p) => p.childId === childId)
}

// This is the filtering logic from kid/$accessCode.tsx (updated defensive version)
function filterPendingChores(chores: Array<MockChoreInstance>, childId: string) {
  return chores.filter((c) => {
    if (c.status !== 'pending') return false
    const myParticipant = getMyParticipant(c, childId)
    if (!myParticipant) return false
    return myParticipant.status === 'pending'
  })
}

function filterCompletedChores(chores: Array<MockChoreInstance>, childId: string) {
  return chores.filter((c) => {
    if (c.status === 'completed') return true
    const myParticipant = getMyParticipant(c, childId)
    if (!myParticipant) return false
    return myParticipant.status === 'done'
  })
}

describe('Joined Chore Visibility', () => {
  const kidA = 'child-a-id'
  const kidB = 'child-b-id'

  function createJoinedChore(
    instanceStatus: 'pending' | 'completed' | 'missed',
    kidAStatus: 'pending' | 'done',
    kidBStatus: 'pending' | 'done'
  ): MockChoreInstance {
    return {
      _id: 'instance-1',
      status: instanceStatus,
      isJoined: true,
      participants: [
        {
          _id: 'participant-a',
          choreInstanceId: 'instance-1',
          childId: kidA,
          status: kidAStatus,
          child: { name: 'Kid A' },
        },
        {
          _id: 'participant-b',
          choreInstanceId: 'instance-1',
          childId: kidB,
          status: kidBStatus,
          child: { name: 'Kid B' },
        },
      ],
    }
  }

  test('both kids see pending chore when neither has marked done', () => {
    const chore = createJoinedChore('pending', 'pending', 'pending')
    const chores = [chore]

    // Kid A should see in pending
    expect(filterPendingChores(chores, kidA)).toHaveLength(1)
    expect(filterCompletedChores(chores, kidA)).toHaveLength(0)

    // Kid B should see in pending
    expect(filterPendingChores(chores, kidB)).toHaveLength(1)
    expect(filterCompletedChores(chores, kidB)).toHaveLength(0)
  })

  test('Kid A marks done - Kid A sees completed, Kid B still sees pending', () => {
    // This is the bug scenario: Kid A marks done, Kid B should still see the chore
    const chore = createJoinedChore('pending', 'done', 'pending')
    const chores = [chore]

    // Kid A should see in completed (their participant status is done)
    expect(filterPendingChores(chores, kidA)).toHaveLength(0)
    expect(filterCompletedChores(chores, kidA)).toHaveLength(1)

    // Kid B should STILL see in pending (their participant status is pending)
    // THIS IS THE BUG: if this fails, the chore "disappears" from Kid B's view
    expect(filterPendingChores(chores, kidB)).toHaveLength(1)
    expect(filterCompletedChores(chores, kidB)).toHaveLength(0)
  })

  test('both kids mark done - both see in completed section', () => {
    const chore = createJoinedChore('pending', 'done', 'done')
    const chores = [chore]

    // Both should see in completed (their participant status is done)
    expect(filterPendingChores(chores, kidA)).toHaveLength(0)
    expect(filterCompletedChores(chores, kidA)).toHaveLength(1)

    expect(filterPendingChores(chores, kidB)).toHaveLength(0)
    expect(filterCompletedChores(chores, kidB)).toHaveLength(1)
  })

  test('instance completed by parent - both see in completed', () => {
    const chore = createJoinedChore('completed', 'done', 'done')
    const chores = [chore]

    // Both should see in completed (instance is completed)
    expect(filterPendingChores(chores, kidA)).toHaveLength(0)
    expect(filterCompletedChores(chores, kidA)).toHaveLength(1)

    expect(filterPendingChores(chores, kidB)).toHaveLength(0)
    expect(filterCompletedChores(chores, kidB)).toHaveLength(1)
  })

  test('non-participant child does not see the chore', () => {
    const chore = createJoinedChore('pending', 'pending', 'pending')
    const chores = [chore]
    const kidC = 'child-c-id' // Not a participant

    // Kid C is not in participants, so find() returns undefined
    // This means the chore won't show in pending (undefined !== 'pending')
    // and won't show in completed (undefined !== 'done')
    expect(filterPendingChores(chores, kidC)).toHaveLength(0)
    expect(filterCompletedChores(chores, kidC)).toHaveLength(0)
  })
})
