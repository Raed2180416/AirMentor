import re

with open('src/modules/academic-admin-offerings-routes.ts', 'r') as f:
    c = f.read()

c = re.sub(r'seeWritten:\s*body\.seeWritten\s*\?\?\s*null,', '', c)
c = re.sub(r'failureMode:\s*body\.failureMode\s*\?\?\s*null,', 'failureMode: body.failureMode ?? undefined,', c) # It may complain about null vs undefined? Let's check schema.

with open('src/modules/academic-admin-offerings-routes.ts', 'w') as f:
    f.write(c)

