# Chores Tracker - Design Document

## Purpose

A gamified household chore management system for Czech-speaking families with children. The app helps parents track and assign chores while motivating kids through a virtual currency reward system.

## Goals

1. **Make chores engaging for kids** - Gamification through rewards, emoji avatars, and kid-friendly UI with TTS support
2. **Simplify parent oversight** - Easy chore assignment, scheduling, and quality-based review workflow
3. **Teach responsibility** - Kids learn accountability through completing tasks and managing virtual earnings
4. **Support collaboration** - Joined chores allow siblings to work together with effort-based reward splits

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                       │
│  ┌──────────────────┐        ┌──────────────────────────┐   │
│  │   Parent Views   │        │      Kid Views           │   │
│  │  - Dashboard     │        │  - Task list (by code)   │   │
│  │  - Children mgmt │        │  - Mark done             │   │
│  │  - Scheduling    │        │  - Optional chores       │   │
│  │  - Review/Rate   │        │  - Balance display       │   │
│  └──────────────────┘        └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Convex)                           │
│  - Real-time subscriptions    - Scheduled cron jobs         │
│  - PIN authentication         - Balance management          │
│  - Chore instance generation  - Quality-based rewards       │
└─────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Users
- **Parents**: Authenticated via PIN, full admin access
- **Kids**: Access via simple 4-digit code, limited to viewing/completing their chores

### Chore Lifecycle
1. **Template** - Reusable chore definition (name, description, default reward)
2. **Schedule** - Assignment rules (which kids, when, reward amount)
3. **Instance** - Generated daily, represents a specific day's task
4. **Participant** - Tracks individual kid progress on joined chores

### Reward System
Quality-based coefficients applied at review time:
- `failed` = 0%, `bad` = 50%, `good` = 100%, `excellent` = 125%

## Key Features

| Feature | Description |
|---------|-------------|
| Flexible Scheduling | Once, daily, weekly, or custom day patterns |
| Optional Chores | Self-service tasks kids can pick up for extra earnings |
| Joined Chores | Multi-kid collaboration with effort-based splits |
| Quality Rating | Parents rate work quality affecting final reward |
| Balance Tracking | Full audit trail of earnings and withdrawals |
| Czech TTS | Text-to-speech for kid-accessible content |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TanStack Router |
| Styling | Tailwind CSS 4 + Radix UI |
| Backend | Convex (serverless functions + database) |
| Testing | Vitest (unit) + Playwright (E2E) |
| Runtime | Bun |

## Data Model

```
children ──────┬──── choreParticipants ────┬──── choreInstances
               │                           │
               │                           │
scheduledChores ───────────────────────────┘
       │
       └──── choreTemplates
```

**Key tables:**
- `children` - Name, avatar, access code, balance
- `choreTemplates` - Reusable chore definitions
- `scheduledChores` - Assignment rules and timing
- `choreInstances` - Daily generated tasks
- `choreParticipants` - Per-kid tracking for joined chores
- `withdrawals` - Balance change audit log

## User Flows

### Parent Workflow
1. Create chore templates
2. Schedule chores (assign to kids, set frequency)
3. Review completed chores daily
4. Rate quality and confirm rewards
5. Manage balance withdrawals

### Kid Workflow
1. Enter access code
2. View today's assigned chores
3. Complete tasks and mark done
4. (Optional) Pick up extra chores after dailies complete
5. View earned balance

## Design Principles

1. **Kid-first UI** - Large touch targets, colorful design, Czech language
2. **Real-time updates** - Convex subscriptions keep all views current
3. **Simple authentication** - PIN for parents, access codes for kids
4. **Audit everything** - Full history of balance changes
5. **Incentivize quality** - Better work = better rewards
