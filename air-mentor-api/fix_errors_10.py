import re

# 1. proof-control-plane
with open('src/lib/msruas-proof-control-plane.ts', 'r') as f:
    c = f.read()

c = re.sub(r'true\.termTestsWeight', '30', c)
c = re.sub(r'true\.quizWeight', '10', c)
c = re.sub(r'true\.assignmentWeight', '20', c)

# 2141 & 2150
c = re.sub(r'ceMark,\s*seeMark,', 'componentScores: { ce: ceMark, see: seeMark },', c)
c = re.sub(r'ceComponentCaps:\s*policy\.ceComponentCaps,', "components: policy.components,", c)

with open('src/lib/msruas-proof-control-plane.ts', 'w') as f:
    f.write(c)

# 2. proof-control-plane-live-run-service
with open('src/lib/proof-control-plane-live-run-service.ts', 'r') as f:
    c = f.read()

c = re.sub(r'ceMark:\s*number;\s*seeMark:\s*number;', 'componentScores: Record<string, number>; condoned?: boolean;', c)
with open('src/lib/proof-control-plane-live-run-service.ts', 'w') as f:
    f.write(c)


# 3. proof-sandbox
with open('src/lib/msruas-proof-sandbox.ts', 'r') as f:
    c = f.read()

c = re.sub(r'ceComponentCaps:\s*policy\.ceComponentCaps,', "components: policy.components,", c)
c = re.sub(r'ceMark,\s*seeMark,', 'componentScores: { ce: ceMark, see: seeMark },', c)

# 1435 type CurriculumSeedCourse... wait it's just an array of objects being pushed. 
c = re.sub(r'ceMark:\s*simulation\.ceMark,', 'componentScores: { ce: simulation.ceMark, see: simulation.seeMark },', c)
c = re.sub(r'seeMark:\s*simulation\.seeMark,', '', c)

# 1529 sgpaScaled
c = re.sub(r'sgpaScaled:\s*Math\.round\(sgpa\s*\*\s*100\),?', 'termMetricsJson: JSON.stringify({ sgpaScaled: Math.round(sgpa * 100) }),', c)

with open('src/lib/msruas-proof-sandbox.ts', 'w') as f:
    f.write(c)


# 4. admin-offerings-routes
with open('src/modules/academic-admin-offerings-routes.ts', 'r') as f:
    c = f.read()

c = re.sub(r'seeWritten:\s*body\.seeWritten\s*\?\s*1\s*:\s*0,?', r'componentStatesJson: JSON.stringify({ seeWritten: body.seeWritten ? 1 : 0 }),', c)

with open('src/modules/academic-admin-offerings-routes.ts', 'w') as f:
    f.write(c)

# 5. academic
with open('src/modules/academic.ts', 'r') as f:
    c = f.read()

c = re.sub(r'tt1Done:\s*boolean;\s*', '', c)
c = re.sub(r'tt2Done:\s*boolean;\s*', '', c)

with open('src/modules/academic.ts', 'w') as f:
    f.write(c)

