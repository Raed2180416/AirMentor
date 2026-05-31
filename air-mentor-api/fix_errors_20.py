import re
with open('src/modules/academic.ts', 'r') as f:
    c = f.read()

c = re.sub(r'if \(!evidence\.locked\) \{', 'if (\'locked\' in evidence && !evidence.locked) {', c)

with open('src/modules/academic.ts', 'w') as f:
    f.write(c)
