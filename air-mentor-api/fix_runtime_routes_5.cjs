const fs = require('fs');
const file = 'src/modules/academic-runtime-routes.ts';
let code = fs.readFileSync(file, 'utf8');

// Fix 1374
code = code.replace(
  /if \(offering\[lockKey\] === 1 \|\| offering\[lockKey\] === true\)/g,
  'if (offering[lockKey] === 1 || (offering[lockKey] as any) === true)'
);

// Fix 1529-1535 (The block with componentStates that I failed to replace)
// Let's use string replace instead of regex since the code is multiline and I messed it up before.
const badBlock1 = `    if (params.kind === 'tt1' || params.kind === 'tt2' || body.lock) {
      const states = { ...componentStates }
      if (params.kind === 'tt1') states.tt1Done = 1
      if (params.kind === 'tt2') states.tt2Done = 1
      if (body.lock) states[\`\$\{params.kind\}Locked\`] = 1

      await context.db.update(sectionOfferings).set({
        componentStatesJson: JSON.stringify(states),
        version: offering.version + 1,
        updatedAt: now,
      }).where(eq(sectionOfferings.offeringId, params.offeringId))
    }`;
const goodBlock1 = `    if (params.kind === 'tt1' || params.kind === 'tt2' || body.lock) {
      const setObj: any = { version: offering.version + 1, updatedAt: now }
      if (params.kind === 'tt1') setObj.tt1Done = 1
      if (params.kind === 'tt2') setObj.tt2Done = 1
      if (body.lock) setObj[\`\$\{params.kind\}Locked\`] = 1

      await context.db.update(sectionOfferings).set(setObj).where(eq(sectionOfferings.offeringId, params.offeringId))
    }`;
code = code.replace(badBlock1, goodBlock1);

const badBlock2 = `    const states = parseJson(offering.componentStatesJson, {} as Record<string,
unknown>)
    if (states[lockKey] !== 1 && states[lockKey] !== true) {
      return { ok: true as const, offeringId: params.offeringId, kind: params.ki
nd, cleared: false, reason: 'already-unlocked' }
    }
    states[lockKey] = 0
    await context.db.update(sectionOfferings).set({
      componentStatesJson: JSON.stringify(states),
      version: offering.version + 1,
      updatedAt: context.now(),
    }).where(eq(sectionOfferings.offeringId, params.offeringId))`;
// Wait, my previous replacement for badBlock2 failed because of the newline in unknown>). Let's use regex with [\s\S]*?
code = code.replace(
  /const states = parseJson\(offering\.componentStatesJson, \{\} as Record<string,\s*unknown>\)[\s\S]*?\}\)\.where\(eq\(sectionOfferings\.offeringId, params\.offeringId\)\)/,
  `if (offering[lockKey] !== 1 && (offering[lockKey] as any) !== true) {
      return { ok: true as const, offeringId: params.offeringId, kind: params.kind, cleared: false, reason: 'already-unlocked' }
    }
    const setObj: any = { version: offering.version + 1, updatedAt: context.now() }
    setObj[lockKey] = 0
    await context.db.update(sectionOfferings).set(setObj).where(eq(sectionOfferings.offeringId, params.offeringId))`
);

fs.writeFileSync(file, code);
