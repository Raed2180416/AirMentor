const fs = require('fs');
const file = 'src/modules/academic-runtime-routes.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');

const startIndex = lines.findIndex(l => l.includes("const states = { ...componentStates }"));
if (startIndex !== -1) {
  let endIndex = startIndex;
  while (!lines[endIndex].includes("}).where(eq(sectionOfferings.offeringId")) {
    endIndex++;
  }
  const replacement = `      const setObj: any = { version: offering.version + 1, updatedAt: now }
      if (params.kind === 'tt1') setObj.tt1Done = 1
      if (params.kind === 'tt2') setObj.tt2Done = 1
      if (body.lock) setObj[\`\$\{params.kind\}Locked\`] = 1

      await context.db.update(sectionOfferings).set(setObj).where(eq(sectionOfferings.offeringId, params.offeringId))`;
  
  lines.splice(startIndex, endIndex - startIndex + 1, replacement);
  fs.writeFileSync(file, lines.join('\n'));
}
