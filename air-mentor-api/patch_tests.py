with open('tests/proof-risk-scoring-parity.test.ts', 'r') as f:
    content = f.read()

import re
new_props = """            backlogCount,
            backlogCredits: backlogCount * 4,
            activeBacklogCredits: backlogCount * 4,
            historicalBacklogCredits: 0,
            clearedBacklogCredits: 0,
            lowerYearBlockerCredits: 0,
            backlogSensitivityScore: 0,"""

content = re.sub(r"\s+backlogCount,", "\n" + new_props, content)

with open('tests/proof-risk-scoring-parity.test.ts', 'w') as f:
    f.write(content)
