use bun for js things

## Design

### Overview
Household chore tracker for kids with parent controls, reward system, and real-time sync.

### Tech Stack
- **Frontend:** React 19, TanStack Router, Vite, Tailwind CSS, Radix UI
- **Backend:** Convex (BaaS - queries, mutations, real-time DB)
- **Testing:** Vitest (unit), Playwright (e2e)
- **Runtime:** Bun

### Project Structure
```
/src              # React frontend
  /components     # UI components (auth/, layout/, ui/)
  /hooks          # Custom hooks (useAuth, useTTS)
  /routes         # File-based routing (TanStack Router)
  /integrations   # Convex provider setup
/convex           # Backend functions and schema
/e2e              # Playwright e2e tests
```

### Key Routes
- `/` - Parent dashboard
- `/kid/*` - Kid views (Czech language, TTS enabled)
- `/chores`, `/schedule`, `/review` - Chore management
- `/settings`, `/children` - Configuration

### Database (Convex)
Main tables: `children`, `choreTemplates`, `scheduledChores`, `choreInstances`, `choreParticipants`, `withdrawals`, `sessions`, `settings`

### Auth
- PIN-based parent auth with session tokens
- 4-digit access codes for kid read-only views

## Mandatory Validation
Run lint, build, and tests after finishing changes:
```bash
bun run lint
bun run build
bun run test          # unit tests
```

For E2E tests (when modifying UI or user flows):
```bash
bunx convex dev&   # start local backend
npm run test:e2e            # run E2E tests
```

Writing e2e tests before updating code is preferred (TDD approach).

## Code style
- never use "any" as a type
- fix all typescript errors
- ask explicit premission to disable linting rules, assume permission will not be given

## Language
All text on kid accessible pages needs to be in czech language, provide tts on all text that is important to be understood by the kids

## Commits
commit after each finished feature with descriptive commit message