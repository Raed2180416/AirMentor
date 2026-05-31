with open('src/lib/msruas-proof-control-plane.ts', 'r') as f:
    content = f.read()

import re

source_new = """  closingBacklogCount: number
  previousBacklogCredits: number
  closingBacklogCredits: number
  activeBacklogCredits: number
  historicalBacklogCredits: number
  clearedBacklogCredits: number
  lowerYearBlockerCredits: number
  backlogSensitivityScore: number"""
content = re.sub(r"  closingBacklogCount: number", source_new, content)

snapshot_new = """  backlogCount: number
  backlogCredits: number
  activeBacklogCredits: number
  historicalBacklogCredits: number
  clearedBacklogCredits: number
  lowerYearBlockerCredits: number
  backlogSensitivityScore: number"""
content = re.sub(r"  backlogCount: number", snapshot_new, content)

with open('src/lib/msruas-proof-control-plane.ts', 'w') as f:
    f.write(content)
