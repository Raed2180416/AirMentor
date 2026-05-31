const fs = require('fs');
const file = 'src/modules/academic-runtime-routes.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /const states = \{ \.\.\.componentStates \}\n\s*if \(params\.kind === 'tt1'\) states\.tt1Done = 1\n\s*if \(params\.kind === 'tt2'\) states\.tt2Done = 1\n\s*if \(body\.lock\) states\[\`\$\{params\.kind\}Locked\`\] = 1\n\n\s*await context\.db\.update\(sectionOfferings\)\.set\(\{\n\s*componentStatesJson: JSON\.stringify\(states\),\n\s*version: offering\.version \+ 1,\n\s*updatedAt: now,\n\s*\}\)\.where\(eq\(sectionOfferings\.offeringId, params\.offeringId\)\)/,
  `const setObj: any = { version: offering.version + 1, updatedAt: now }
      if (params.kind === 'tt1') setObj.tt1Done = 1
      if (params.kind === 'tt2') setObj.tt2Done = 1
      if (body.lock) setObj[\`\$\{params.kind\}Locked\`] = 1

      await context.db.update(sectionOfferings).set(setObj).where(eq(sectionOfferings.offeringId, params.offeringId))`
);

fs.writeFileSync(file, code);
