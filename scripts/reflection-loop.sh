#!/bin/bash
# AirMentor Reflection Loop — Self-Correction After Generation
# SOTA 2026: Models that review their own output catch 40% more bugs
# Usage: After any agent generates code, pipe it through this loop

set -euo pipefail

INPUT_FILE="${1:-/dev/stdin}"
TASK_TYPE="${2:-code-generation}"

# Read the generated output
generated=$(cat "$INPUT_FILE")

echo "=== REFLECTION LOOP ==="
echo "Task type: $TASK_TYPE"
echo ""

# Build reflection prompt based on task type
case "$TASK_TYPE" in
  code-generation)
    reflection_prompt="You just wrote the following code. Review it carefully and answer:

1. Does it compile/type-check?
2. Are there any obvious bugs?
3. Are all edge cases handled?
4. Does it follow the project's existing patterns?
5. Are variable names clear and consistent?

If you find ANY issues, list them with severity (critical/warning/info) and the corrected code.
If no issues, respond with exactly: NO_ISSUES_FOUND

Generated code:
\`\`\`
${generated}
\`\`\`"
    ;;
  bug-fix)
    reflection_prompt="You just proposed a bug fix. Review it:

1. Does the fix actually address the root cause?
2. Could it introduce new bugs?
3. Are there other places with the same bug?
4. Is there a test that would verify this fix?

If issues found, list them. Otherwise: NO_ISSUES_FOUND

Proposed fix:
\`\`\`
${generated}
\`\`\`"
    ;;
  *)
    reflection_prompt="Review the following output for correctness, completeness, and accuracy:

${generated}

List any issues found, or respond NO_ISSUES_FOUND."
    ;;
esac

# In production, this would call the API router with the reflection prompt
# For now, output the reflection prompt for the orchestrator to use
echo "$reflection_prompt"
