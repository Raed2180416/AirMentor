with open('src/lib/msruas-proof-control-plane.ts', 'r') as f:
    content = f.read()

import re

# 1. Add activeBacklogCredits to buildSeededSemesterSixRows arguments
content = content.replace("activeBacklogCount: historical.activeBacklogCount,", "activeBacklogCount: historical.activeBacklogCount,\n      activeBacklogCredits: historical.activeBacklogCredits,")

# 2. Fix the evaluateCourseStatus mismatch
# evaluateCourseStatus is passed to finalizeSeededProofRunService, but wait, the type error was about ProofControlPlaneLiveRunServiceDeps!
with open('src/lib/msruas-proof-control-plane.ts', 'w') as f:
    f.write(content)
