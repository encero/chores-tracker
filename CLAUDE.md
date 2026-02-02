# Project

read design.md file as reference of the project design and structure.
When doing significant changes to the project update design.md file to reflect the changes.


# Coding

use bun for js things

## Mandatory Validation
Run lint, build, and tests after finishing changes:
```bash
bun run lint
bun run build
bun run test          # unit tests
```

For E2E tests (when modifying UI or user flows):

### If .env.local has Convex cloud config (this repo)
When the repo is configured with a cloud deployment in `.env.local`:
```bash
# 1. Push functions to Convex cloud
bunx convex dev --once

# 2. Enable test mode on Convex (allows test mutations to run)
bunx convex env set IS_TEST true

# 3. Start the dev server in background
bun run dev &

# 4. Run E2E tests (uses VITE_CONVEX_URL from .env.local)
source .env.local && npm run test:e2e

# 5. IMPORTANT: Disable test mode when done
bunx convex env set IS_TEST false
```

### If .env.local is empty or missing
When no cloud deployment is configured, you can run a local Convex backend:
```bash
# Start local Convex backend (runs on port 3210)
CONVEX_AGENT_MODE=anonymous bunx convex dev &
sleep 5

# Start dev server
bun run dev &

# Run E2E tests (test-setup.ts defaults to localhost:3210)
npm run test:e2e
```

Note: `.env.local` takes precedence over `CONVEX_AGENT_MODE` - if cloud config exists, it will be used.


## Code style
- Writing e2e tests before updating code is preferred (TDD approach).
- never use "any" as a type
- fix all typescript errors
- ask explicit premission to disable linting rules, assume permission will not be given

## Language
All text on kid accessible pages needs to be in czech language, provide tts on all text that is important to be understood by the kids

## Commits
commit after each finished feature with descriptive commit message
