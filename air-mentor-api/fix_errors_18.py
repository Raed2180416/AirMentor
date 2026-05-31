import re
with open('src/modules/academic.ts', 'r') as f:
    c = f.read()

c = re.sub(r'const completenessChecks = offerings\.flatMap\(offering => \[0, 0, 0, 0, 0\]\)', 'const completenessChecks = offerings.flatMap(() => [0, 0, 0, 0, 0])', c)

with open('src/modules/academic.ts', 'w') as f:
    f.write(c)
