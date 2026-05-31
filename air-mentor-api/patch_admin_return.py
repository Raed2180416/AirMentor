with open('src/modules/admin-structure.ts', 'r') as f:
    content = f.read()

return_statement = """  return {
    gradeBands,
    ceSeeSplit,
    ceComponentCaps,
    workingCalendar,
    attendanceRules,
    condonationRules,
    eligibilityRules,
    passRules,
    roundingRules,
    sgpaCgpaRules,
    progressionRules,
    riskRules,
    remediationRules: policy.remediationRules ?? DEFAULT_POLICY.remediationRules,
    durationRules: policy.durationRules ?? DEFAULT_POLICY.durationRules,
    yearBackRules: policy.yearBackRules ?? DEFAULT_POLICY.yearBackRules,
  }"""

import re
# find the return block that starts with "return {\n    gradeBands," and ends with "riskRules,\n  }"
content = re.sub(r"return \{\n\s*gradeBands,\n\s*ceSeeSplit,\n.*?riskRules,\n\s*\}", return_statement, content, flags=re.DOTALL)

with open('src/modules/admin-structure.ts', 'w') as f:
    f.write(content)
