import re

# academic.ts
with open('src/modules/academic.ts', 'r') as f:
    c = f.read()
c = re.sub(r'tt1Done:\s*boolean\n\s*tt2Done:\s*boolean', '', c)
with open('src/modules/academic.ts', 'w') as f:
    f.write(c)
