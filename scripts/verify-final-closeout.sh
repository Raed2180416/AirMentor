#!/usr/bin/env bash
set -euo pipefail

npm run lint
npm run inventory:compat-routes
npm run verify:proof-closure:proof-rc
npm run playwright:admin-live:acceptance
npm run playwright:admin-live:request-flow
npm run playwright:admin-live:teaching-parity
npm run playwright:admin-live:accessibility-regression
npm run playwright:admin-live:keyboard-regression
npm run playwright:admin-live:session-security
