const fs = require('fs');
const file = 'src/modules/academic-runtime-routes.ts';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `const lockKey = \`\$\{params.kind\}Locked\`
    const states = parseJson(offering.componentStatesJson, {} as Record<string,
unknown>)
    if (states[lockKey] !== 1 && states[lockKey] !== true) {
      return { ok: true as const, offeringId: params.offeringId, kind: params.kind, cleared: false, reason: 'already-unlocked' }
    }
    states[lockKey] = 0
    await context.db.update(sectionOfferings).set({
      componentStatesJson: JSON.stringify(states),
      version: offering.version + 1,
      updatedAt: context.now(),
    }).where(eq(sectionOfferings.offeringId, params.offeringId))`;

const replacement = `const lockKey = \`\$\{params.kind\}Locked\` as keyof typeof offering
    if (offering[lockKey] !== 1 && offering[lockKey] !== true) {
      return { ok: true as const, offeringId: params.offeringId, kind: params.kind, cleared: false, reason: 'already-unlocked' }
    }
    const setObj: any = { version: offering.version + 1, updatedAt: context.now() }
    setObj[lockKey] = 0
    await context.db.update(sectionOfferings).set(setObj).where(eq(sectionOfferings.offeringId, params.offeringId))`;

code = code.replace(targetStr, replacement);
fs.writeFileSync(file, code);
