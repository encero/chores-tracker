use bun for js things
bunx convex dev --once for convex verification add --local if dev credentials arent set

## Mandatory Validation
Run lint, build, and tests after finishing changes:
```bash
bun run lint
bun run build
bun run test          # unit tests
```

For E2E tests (when modifying UI or user flows):
```bash
bunx convex dev --local &   # start local backend
npm run test:e2e            # run E2E tests
```

Writing tests before updating code is preferred (TDD approach).

## Language
All text on kid accessible pages needs to be in czech language, provide tts on all text that is important to be understood by the kids

## Commits
commit after each finished feature with descriptive commit message