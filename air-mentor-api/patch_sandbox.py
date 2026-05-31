with open('src/lib/msruas-proof-sandbox.ts', 'r') as f:
    content = f.read()
content = content.replace("termMetricsJson: JSON.stringify({ sgpaScaled: Math.round(sgpa * 100) }),", "sgpaScaled: Math.round(sgpa * 100),")
import re
content = re.sub(r'backlogCredits:.*?\n', '', content)
content = re.sub(r'activeBacklogCredits:.*?\n', '', content)
content = re.sub(r'clearedBacklogCredits:.*?\n', '', content)
content = re.sub(r'failureMode:.*?\n', '', content)
with open('src/lib/msruas-proof-sandbox.ts', 'w') as f:
    f.write(content)
