const fs = require('fs');

const tsCode = fs.readFileSync('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/lib/proof-risk-model.ts', 'utf-8');
const match = tsCode.match(/export const OBSERVABLE_FEATURE_KEYS = \[\s*([\s\S]*?)\] as const/);
const tsKeys = match ? match[1].split('\n').map(l => l.replace(/[^a-zA-Z0-9]/g, '')).filter(x => x) : [];
console.log('TS Keys:', tsKeys.length);

const pyCode = fs.readFileSync('/home/raed/Projects/air-mentor-ui/air-mentor-api/scripts/generate_v2_data.py', 'utf-8');
const pyMatch = pyCode.match(/FEATURE_KEYS = \[\s*([\s\S]*?)\]/);
const pyKeys = pyMatch ? pyMatch[1].split(',').map(x => x.replace(/[^a-zA-Z0-9]/g, '')).filter(x => x) : [];
console.log('PY Keys:', pyKeys.length);

console.log('TS Missing in PY:', tsKeys.filter(x => !pyKeys.includes(x)));
console.log('PY Missing in TS:', pyKeys.filter(x => !tsKeys.includes(x)));

const sameOrder = tsKeys.every((x, i) => x === pyKeys[i]);
console.log('Same Order:', sameOrder);
