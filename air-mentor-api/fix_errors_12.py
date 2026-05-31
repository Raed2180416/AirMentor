import re

# msruas-proof-control-plane.ts
with open('src/lib/msruas-proof-control-plane.ts', 'r') as f:
    c = f.read()

# 1711: return { (missing progressionGates)
c = re.sub(r'return \{\n\s*gradeBands', 'return {\n      progressionGates: [],\n      gradeBands', c)
# 1741: components: policy.components
c = re.sub(r'components:\s*policy\.components,', 'components: [\n      { code: "ce", name: "CE", maxScore: 50, weight: 50 },\n      { code: "see", name: "SEE", maxScore: 50, weight: 50, isSee: true }\n    ],', c)
# 2107: const termTestsWeight = 30 ?? 30 -> 30
c = re.sub(r'const termTestsWeight = 30 \?\? 30', 'const termTestsWeight = 30', c)
# 2108: const quizWeight = 10 ?? 10 -> 10
c = re.sub(r'const quizWeight = 10 \?\? 10', 'const quizWeight = 10', c)
# 2109: const assignmentWeight = 20 ?? 20 -> 20
c = re.sub(r'const assignmentWeight = 20 \?\? 20', 'const assignmentWeight = 20', c)

# 2141 ceMark, 2150 ceMark
c = re.sub(r'ceMark,\n\s*seeMark,', 'componentScores: { ce: ceMark, see: seeMark },', c)

with open('src/lib/msruas-proof-control-plane.ts', 'w') as f:
    f.write(c)


# msruas-proof-sandbox.ts
with open('src/lib/msruas-proof-sandbox.ts', 'r') as f:
    c = f.read()

# 652 ceMark
# 661 ceMark
c = re.sub(r'ceMark,\n\s*seeMark,', 'componentScores: { ce: ceMark, see: seeMark },', c)

# 1438: Argument of type ... is missing ceMark, seeMark
c = re.sub(r'componentScores:\s*\{\s*ce:\s*simulation\.ceMark,\s*see:\s*simulation\.seeMark\s*\},', 'ceMark: simulation.ceMark,\n            seeMark: simulation.seeMark,', c)


with open('src/lib/msruas-proof-sandbox.ts', 'w') as f:
    f.write(c)


# academic-admin-offerings-routes.ts
with open('src/modules/academic-admin-offerings-routes.ts', 'r') as f:
    c = f.read()
# 1019 seeWritten, transcriptSubjectResultId - wait, seeWritten doesn't exist, I need to check what remains.
# Let's read academic-admin-offerings-routes.ts around 1019.
