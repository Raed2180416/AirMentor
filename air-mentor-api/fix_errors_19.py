import re
with open('src/modules/academic.ts', 'r') as f:
    c = f.read()

c = re.sub(r'if \(true\) \{\n\s*blockingReasons\.push\(`\$\{kind\} is not locked`\)\n\s*\}', 'if (!evidence.locked) {\n      blockingReasons.push(`${kind} is not locked`)\n    }', c)

with open('src/modules/academic.ts', 'w') as f:
    f.write(c)
