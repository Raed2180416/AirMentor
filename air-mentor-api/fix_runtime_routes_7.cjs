const fs = require('fs');
const file = 'src/modules/academic-runtime-routes.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /if \(offering\[lockKey\] !== 1 && \(offering\[lockKey\] as any\) !== true\)/,
  'if ((offering as any)[lockKey] !== 1 && (offering as any)[lockKey] !== true)'
);

code = code.replace(
  /if \(offering\[lockKey\] === 1 \|\| \(offering\[lockKey\] as any\) === true\)/,
  'if ((offering as any)[lockKey] === 1 || (offering as any)[lockKey] === true)'
);

fs.writeFileSync(file, code);
