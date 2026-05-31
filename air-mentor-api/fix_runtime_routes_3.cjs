const fs = require('fs');
const file = 'src/modules/academic-runtime-routes.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /const lockKey = \`\$\{params\.kind\}Locked\`\n\s*const states = parseJson\(offering\.componentStatesJson, \{\} as Record<string,\nunknown>\)\n\s*if \(states\[lockKey\] !== 1 && states\[lockKey\] !== true\) \{\n\s*return \{ ok: true as const, offeringId: params\.offeringId, kind: params\.kind, cleared: false, reason: 'already-unlocked' \}\n\s*\}\n\s*states\[lockKey\] = 0\n\s*await context\.db\.update\(sectionOfferings\)\.set\(\{\n\s*componentStatesJson: JSON\.stringify\(states\),\n\s*version: offering\.version \+ 1,\n\s*updatedAt: context\.now\(\),\n\s*\}\)\.where\(eq\(sectionOfferings\.offeringId, params\.offeringId\)\)/,
  `const lockKey = \`\$\{params.kind\}Locked\` as keyof typeof offering
    if (offering[lockKey] !== 1 && offering[lockKey] !== true) {
      return { ok: true as const, offeringId: params.offeringId, kind: params.kind, cleared: false, reason: 'already-unlocked' }
    }
    const setObj: any = { version: offering.version + 1, updatedAt: context.now() }
    setObj[lockKey] = 0
    await context.db.update(sectionOfferings).set(setObj).where(eq(sectionOfferings.offeringId, params.offeringId))`
);

fs.writeFileSync(file, code);
