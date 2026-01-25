//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  { ignores: ['convex/_generated/*.js', '.output/**', '*.config.js'] },
  ...tanstackConfig,
]
