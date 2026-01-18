# Chores Tracker - Design Document

## Overview

A family chores tracking application where parents can assign chores to children, track completion, rate quality, and manage monetary rewards.

## Tech Stack

- **Frontend**: React 19, TanStack Router, Tailwind CSS v4
- **Backend**: Convex (real-time database with serverless functions)
- **Icons**: Lucide React

---

## Authentication

### Overview

Simple PIN-based authentication for parents. The app is designed for local network deployment, so security is lightweight.

| View | Authentication |
|------|----------------|
| Parent views (`/`, `/children`, `/chores`, etc.) | PIN required |
| Kid views (`/kid/:accessCode`) | Public (no auth) |

### How It Works

1. **PIN Storage**: A 4-6 digit PIN stored in the `settings` table (hashed)
2. **Session**: PIN verified once, session stored in localStorage with expiry
3. **No Accounts**: Single PIN for all parent access (no usernames)
4. **First Run**: If no PIN exists, prompt to set one on first visit

### Security Considerations

- PIN is hashed before storage (simple hash, not bcrypt - local network only)
- Session token expires after configurable period (default: 7 days)
- No rate limiting needed for local network
- Kid access codes are separate from parent PIN

### PIN Entry UX

- Simple numeric keypad interface
- "Remember me" option to extend session
- Lock icon in header shows authenticated state
- "Lock" button to manually end session

---

## Data Model

### Tables

#### `settings`
Single-row table for app configuration.

| Field | Type | Description |
|-------|------|-------------|
| `pinHash` | string? | Hashed parent PIN (null if not set) |
| `sessionDurationDays` | number | How long sessions last (default: 7) |
| `currency` | string | Currency symbol (default: "$") |

#### `children`
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Child's display name |
| `avatarEmoji` | string | Emoji avatar for kid-friendly UI |
| `accessCode` | string | Simple 4-digit code for kid's read-only view |
| `balance` | number | Current accumulated reward balance (cents) |

#### `choreTemplates`
| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Chore name (e.g., "Make bed") |
| `description` | string? | Optional detailed instructions |
| `defaultReward` | number | Default reward in cents (0 = no reward) |
| `icon` | string | Emoji icon for visual recognition |

#### `scheduledChores`
| Field | Type | Description |
|-------|------|-------------|
| `childIds` | id[] | References to children (single for individual, multiple for joined) |
| `choreTemplateId` | id | Reference to chore template |
| `reward` | number | Total reward for this chore (cents, can override template) |
| `isJoined` | boolean | True if this is a joined chore (reward split by effort) |
| `scheduleType` | string | "once" \| "daily" \| "weekly" \| "custom" |
| `scheduleDays` | number[]? | For custom: days of week (0=Sun, 1=Mon...) |
| `startDate` | string | ISO date when schedule starts |
| `endDate` | string? | ISO date when schedule ends (null = indefinite) |
| `isActive` | boolean | Whether schedule is active |

#### `choreInstances`
| Field | Type | Description |
|-------|------|-------------|
| `scheduledChoreId` | id | Reference to scheduled chore |
| `dueDate` | string | ISO date when chore is due |
| `isJoined` | boolean | Copied from schedule for query convenience |
| `status` | string | "pending" \| "completed" \| "missed" |
| `completedAt` | number? | Timestamp when fully complete |
| `quality` | string? | "bad" \| "good" \| "excellent" (overall quality for joined) |
| `totalReward` | number | Total reward pool for this instance |
| `notes` | string? | Optional parent notes |

#### `choreParticipants`
Tracks individual child participation in chore instances (both individual and joined).

| Field | Type | Description |
|-------|------|-------------|
| `choreInstanceId` | id | Reference to chore instance |
| `childId` | id | Reference to child |
| `status` | string | "pending" \| "done" (individual completion status) |
| `completedAt` | number? | When this child marked done |
| `effortPercent` | number? | Effort contribution 0-100 (for joined chores, set by parent) |
| `earnedReward` | number? | Actual reward earned (calculated after review) |

#### `withdrawals`
| Field | Type | Description |
|-------|------|-------------|
| `childId` | id | Reference to child |
| `amount` | number | Amount withdrawn (cents) |
| `createdAt` | number | Timestamp of withdrawal |
| `note` | string? | Optional note (e.g., "Bought toy") |

---

## Quality Coefficients

| Quality | Coefficient | Example |
|---------|-------------|---------|
| Bad | 0.5x | $1.00 chore → $0.50 earned |
| Good | 1.0x | $1.00 chore → $1.00 earned |
| Excellent | 1.25x | $1.00 chore → $1.25 earned |

---

## Joined Chores

Joined chores allow multiple children to work together on a single task, with the reward split based on their effort contribution.

### How It Works

1. **Assignment**: Parent assigns a chore to multiple children and marks it as "joined"
2. **Completion**: Each child marks themselves as "done" when they finish their part
3. **Review**: Parent reviews the chore once all participants are done (or manually)
4. **Effort Split**: Parent assigns effort percentages to each child (must total 100%)
5. **Reward Calculation**: Each child's reward = `totalReward × effortPercent × qualityCoefficient`

### Effort Distribution Options

| Mode | Description |
|------|-------------|
| Equal Split | Default: reward divided equally (e.g., 2 kids = 50% each) |
| Custom Split | Parent manually assigns percentages (e.g., 70%/30%) |

### Example: Joined Chore

**Scenario**: "Clean the garage" - $10.00 reward, assigned to Emma and Jack

1. Emma and Jack both mark "done"
2. Parent reviews and rates quality as "Good" (1.0x)
3. Parent assigns effort: Emma 60%, Jack 40%
4. **Rewards**:
   - Emma: $10.00 × 60% × 1.0 = **$6.00**
   - Jack: $10.00 × 40% × 1.0 = **$4.00**

### Visual Indicators

- Joined chores show a "team" icon and list all participants
- Progress bar shows how many participants have marked done
- In kid view, they see their teammates and who has completed

---

## Routes & Views

### Authentication Routes (Public)

#### `/login` - PIN Entry
- Numeric keypad for PIN entry
- "Remember me" checkbox (extends session to 30 days)
- First-time setup: prompt to create PIN if none exists
- Redirect to `/` on success

#### `/setup` - First Time Setup
- Only accessible if no PIN is set
- Create PIN (enter twice to confirm)
- Basic settings (currency symbol)
- Redirect to `/` on completion

### Parent Views (PIN Required)

All parent routes redirect to `/login` if no valid session.

#### `/` - Dashboard
- Overview cards showing each child with:
  - Avatar and name
  - Current balance
  - Today's pending chores count
  - Quick action buttons
- Today's chores list across all children
- Recent activity feed

#### `/children` - Manage Children
- List of children with add/edit/delete
- Click child to view details

#### `/children/:childId` - Child Detail
- Child info and balance
- Their scheduled chores
- Completion history
- Withdrawal history
- Actions: Edit, Withdraw balance

#### `/chores` - Chore Templates
- List of chore templates
- Add/edit/delete templates
- See which children have each chore assigned

#### `/schedule` - Schedule Management
- Assign chores to children
- Configure recurrence
- Set custom rewards
- Bulk actions

#### `/review` - Review Completed Chores
- List of chores marked complete awaiting quality rating
- Quick rate buttons (bad/good/excellent)
- Batch rating support

### Kid Views (Read-Only)

#### `/kid/:accessCode` - Kid Dashboard
- Large friendly display of their avatar and name
- Prominent balance display (like a piggy bank)
- Today's chores with status
- This week's upcoming chores
- Recent completed chores with ratings
- No edit capabilities

---

## UX Design Principles

### 1. Mobile-First
- Large touch targets (min 44px)
- Bottom navigation for common actions
- Swipe gestures for quick actions (mark complete)

### 2. Visual Hierarchy
- Balance always visible and prominent
- Color-coded status:
  - Gray: Pending
  - Yellow: In Progress / Awaiting Review
  - Green: Completed (Good/Excellent)
  - Red: Missed / Bad quality
- Emoji icons for quick recognition

### 3. Minimal Friction
- Mark complete: Single tap
- Rate quality: Three big buttons (with emoji feedback)
- Add chore: Template-based for speed
- Kid view: No login, just access code in URL

### 4. Kid-Friendly Design
- Large text and icons
- Fun avatars (emoji-based)
- Celebratory animations for completions
- Simple language
- Balance shown as both cents and dollars

### 5. Parent Efficiency
- Dashboard shows what needs attention
- Batch operations for rating multiple chores
- Quick-add recurring chores
- One-tap withdrawal with confirmation

---

## Key User Flows

### Flow 1: Parent Creates a Chore Schedule
1. Parent goes to `/schedule`
2. Clicks "Assign Chore"
3. Selects child (or multiple children)
4. Selects chore template (or creates new)
5. Sets reward (defaults from template)
6. Chooses recurrence (daily, weekly, custom days)
7. Saves - chore instances auto-generated

### Flow 2: Child Completes a Chore
1. Child views their dashboard via `/kid/1234`
2. Sees today's chores with checkboxes
3. Taps "Done" on completed chore
4. Chore moves to "Awaiting Review" state
5. Parent gets notification (future: push notification)

### Flow 3: Parent Reviews Chores
1. Parent goes to `/review` (or sees badge on nav)
2. Sees list of chores awaiting quality rating
3. For each: taps Bad/Good/Excellent
4. Balance auto-updates, chore marked complete
5. Child sees updated balance on their view

### Flow 4: Parent Withdraws Balance
1. Parent goes to child detail page
2. Sees current balance
3. Clicks "Withdraw"
4. Confirms amount (default: full balance)
5. Optionally adds note
6. Balance resets, withdrawal logged

### Flow 5: Joined Chore (Multiple Kids)
1. Parent creates a chore and selects multiple children
2. Toggles "Joined chore" option (reward split by effort)
3. Sets total reward (e.g., $10.00)
4. Saves - one shared chore instance created
5. Each child sees the chore on their dashboard with teammate avatars
6. Children independently mark themselves as "done"
7. Dashboard shows progress (e.g., "1/2 done")
8. Once all done (or parent triggers review), chore appears in review
9. Parent rates overall quality
10. Parent adjusts effort split (defaults to equal, can customize)
11. System calculates: `reward × effort% × quality coefficient` per child
12. Each child's balance updated with their portion

---

## Component Structure

```
src/
├── components/
│   ├── ui/                    # Shadcn-style base components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── ParentLayout.tsx   # Nav, header for parent views
│   │   └── KidLayout.tsx      # Simplified layout for kids
│   ├── chores/
│   │   ├── ChoreCard.tsx      # Displays a single chore instance
│   │   ├── JoinedChoreCard.tsx # Displays joined chore with participants
│   │   ├── ChoreList.tsx      # List of chores
│   │   ├── QualityRater.tsx   # Bad/Good/Excellent buttons
│   │   ├── EffortSplitter.tsx # UI for assigning effort percentages
│   │   ├── ParticipantList.tsx # Shows participants and their status
│   │   └── ScheduleForm.tsx   # Form for scheduling chores
│   ├── children/
│   │   ├── ChildCard.tsx      # Child overview card
│   │   ├── BalanceDisplay.tsx # Shows balance nicely
│   │   └── WithdrawModal.tsx  # Withdrawal confirmation
│   ├── auth/
│   │   ├── PinPad.tsx         # Numeric keypad for PIN entry
│   │   ├── AuthGuard.tsx      # Wrapper that redirects if not authenticated
│   │   └── useAuth.ts         # Hook for auth state and actions
│   └── shared/
│       ├── EmojiPicker.tsx    # For avatars and icons
│       └── LoadingSpinner.tsx
├── routes/
│   ├── __root.tsx
│   ├── login.tsx              # PIN entry page
│   ├── setup.tsx              # First-time PIN setup
│   ├── index.tsx              # Parent dashboard (protected)
│   ├── children/
│   │   ├── index.tsx          # Children list (protected)
│   │   └── $childId.tsx       # Child detail (protected)
│   ├── chores.tsx             # Chore templates (protected)
│   ├── schedule.tsx           # Schedule management (protected)
│   ├── review.tsx             # Review completed chores (protected)
│   ├── settings.tsx           # App settings, change PIN (protected)
│   └── kid/
│       └── $accessCode.tsx    # Kid read-only view (public)
```

---

## Convex Functions

### Queries
- `settings.get` - Get app settings (includes whether PIN is set)
- `auth.verifySession` - Check if session token is valid
- `children.list` - Get all children
- `children.get` - Get child by ID
- `children.getByAccessCode` - Get child by access code (for kid view)
- `choreTemplates.list` - Get all templates
- `choreInstances.getToday` - Get today's chores for all/one child
- `choreInstances.getForReview` - Get chores awaiting rating (includes joined with all done)
- `choreInstances.getHistory` - Get completed chores history
- `choreParticipants.getForInstance` - Get all participants for a chore instance
- `choreParticipants.getForChild` - Get child's participation records
- `withdrawals.getForChild` - Get withdrawal history

### Mutations
- `settings.initialize` - Create settings with PIN on first run
- `settings.update` - Update settings (currency, session duration)
- `settings.changePin` - Change parent PIN (requires current PIN)
- `auth.login` - Verify PIN, return session token
- `children.create` / `update` / `delete`
- `choreTemplates.create` / `update` / `delete`
- `scheduledChores.create` / `update` / `delete`
- `choreInstances.markComplete` - Child marks chore done (or their part in joined)
- `choreInstances.rate` - Parent rates quality, calculates reward (handles joined split)
- `choreInstances.markMissed` - Mark overdue chore as missed
- `choreParticipants.markDone` - Individual child marks their part done in joined chore
- `choreParticipants.setEffort` - Parent sets effort percentages for joined chore
- `withdrawals.create` - Create withdrawal, reset balance

### Scheduled Jobs (Convex Cron)
- `generateDailyChores` - Run at midnight, create instances for recurring chores
- `markMissedChores` - Run at midnight, mark yesterday's incomplete as missed

---

## Future Enhancements (Out of Scope)

- Push notifications
- Multiple parents/households
- Chore trading between siblings
- Streak bonuses
- Custom quality scales
- Photo proof of completion
- Allowance integration
