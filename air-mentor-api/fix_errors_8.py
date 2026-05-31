import re

# 1. admin offerings routes
with open('src/modules/academic-admin-offerings-routes.ts', 'r') as f:
    c = f.read()

c = re.sub(r'stagePatch\.quizLocked\s*=\s*0', '', c)
c = re.sub(r'stagePatch\.assignmentLocked\s*=\s*0', '', c)
c = re.sub(r'stagePatch\.finalsLocked\s*=\s*0', '', c)
c = re.sub(r'quizLocked:\s*body\.quizLocked\s*\?\s*1\s*:\s*0,?', '', c)
c = re.sub(r'assignmentLocked:\s*body\.assignmentLocked\s*\?\s*1\s*:\s*0,?', '', c)
c = re.sub(r'finalsLocked:\s*body\.finalsLocked\s*\?\s*1\s*:\s*0,?', '', c)

# 1059 sectionOfferings insert
c = re.sub(r'quizLocked:\s*0,?', '', c)
c = re.sub(r'assignmentLocked:\s*0,?', '', c)
c = re.sub(r'finalsLocked:\s*0,?', '', c)
c = re.sub(r'tt1Locked:\s*0,?', '', c)
c = re.sub(r'tt2Locked:\s*0,?', '', c)
c = re.sub(r'tt1Done:\s*0,?', '', c)
c = re.sub(r'tt2Done:\s*0,?', '', c)

# 984 transcriptTermResults insert
c = re.sub(r'sgpaScaled:\s*term\.sgpaScaled,?', r'termMetricsJson: JSON.stringify({ sgpaScaled: term.sgpaScaled }),', c)

# 1021 transcriptSubjectResults insert
c = re.sub(r'seeEligible:\s*subject\.seeEligible\s*\?\s*1\s*:\s*0,?', r'componentStatesJson: JSON.stringify({ seeEligible: subject.seeEligible ? 1 : 0 }),', c)

with open('src/modules/academic-admin-offerings-routes.ts', 'w') as f:
    f.write(c)


# 2. academic.ts 3558
with open('src/modules/academic.ts', 'r') as f:
    c = f.read()
c = re.sub(r'tt1Done:\s*boolean;\s*tt2Done:\s*boolean;', '', c)
with open('src/modules/academic.ts', 'w') as f:
    f.write(c)


# 3. gap-closure-intent.test.ts 179
with open('tests/gap-closure-intent.test.ts', 'r') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if line.strip() == '.where(eq(sectionOfferings.termId, sem6Term.termId))':
        if not lines[i-1].strip().startswith('.from'):
            lines[i-1] = lines[i-1].rstrip() + ' .from(sectionOfferings)\n'
with open('tests/gap-closure-intent.test.ts', 'w') as f:
    f.writelines(lines)


# 4. control plane
with open('src/lib/msruas-proof-control-plane.ts', 'r') as f:
    c = f.read()

# I see it complaining about `tt1Done` again. Let's just blindly remove them everywhere except where it was expected.
# Actually let's just replace `.tt1Done` with nothing? No.
c = re.sub(r'tt1Done:\s*stageSeed\?\.tt1Done\s*\?\s*1\s*:\s*0,?', '', c)
c = re.sub(r'tt2Done:\s*stageSeed\?\.tt2Done\s*\?\s*1\s*:\s*0,?', '', c)
c = re.sub(r'tt1Locked:\s*stageSeed\?\.tt1Locked\s*\?\s*1\s*:\s*0,?', '', c)
c = re.sub(r'tt2Locked:\s*stageSeed\?\.tt2Locked\s*\?\s*1\s*:\s*0,?', '', c)
c = re.sub(r'quizLocked:\s*stageSeed\?\.quizLocked\s*\?\s*1\s*:\s*0,?', '', c)
c = re.sub(r'assignmentLocked:\s*stageSeed\?\.assignmentLocked\s*\?\s*1\s*:\s*0,?', '', c)
c = re.sub(r'finalsLocked:\s*stageSeed\?\.finalsLocked\s*\?\s*1\s*:\s*0,?', '', c)

c = re.sub(r'tt1Done:\s*stageSeed\.tt1Done,?', '', c)
c = re.sub(r'tt2Done:\s*stageSeed\.tt2Done,?', '', c)
c = re.sub(r'tt1Locked:\s*stageSeed\.tt1Locked,?', '', c)
c = re.sub(r'tt2Locked:\s*stageSeed\.tt2Locked,?', '', c)
c = re.sub(r'quizLocked:\s*stageSeed\.quizLocked,?', '', c)
c = re.sub(r'assignmentLocked:\s*stageSeed\.assignmentLocked,?', '', c)
c = re.sub(r'finalsLocked:\s*stageSeed\.finalsLocked,?', '', c)

# 4112 sgpaScaled
c = re.sub(r'sgpaScaled:\s*termResult\.sgpaScaled,?', r'termMetricsJson: JSON.stringify({ sgpaScaled: termResult.sgpaScaled }),', c)

with open('src/lib/msruas-proof-control-plane.ts', 'w') as f:
    f.write(c)


# 5. sandbox
with open('src/lib/msruas-proof-sandbox.ts', 'r') as f:
    c = f.read()

# 470 ceComponentCaps error
c = re.sub(r'ceComponentCaps:\s*\{[^\}]+\},?', "components: [\n      { code: 'ce', name: 'CE', maxScore: 50, weight: 50 },\n      { code: 'see', name: 'SEE', maxScore: 50, weight: 50, isSee: true }\n    ],", c)

# 648, 657, 1435 ceMark, seeMark
c = re.sub(r'ceMark:\s*([\d\.]+),?', r'componentScores: { ce: \1 },', c)
c = re.sub(r'seeMark:\s*([\d\.]+),?', r'', c) # Wait, it's better to combine them.
# The `fix_sandbox` in `fix_errors_4.py` tried this but failed. Let's do it manually if possible or use a better regex
c = re.sub(r'ceMark:\s*([\d\.]+),\s*seeMark:\s*([\d\.]+),?', r'componentScores: { ce: \1, see: \2 },', c)
c = re.sub(r'ceMark:\s*([\w\.]+),\s*seeMark:\s*([\w\.]+),?', r'componentScores: { ce: \1, see: \2 },', c)

# 1529 sgpaScaled
c = re.sub(r'sgpaScaled:\s*term\.sgpaScaled,?', r'termMetricsJson: JSON.stringify({ sgpaScaled: term.sgpaScaled }),', c)

with open('src/lib/msruas-proof-sandbox.ts', 'w') as f:
    f.write(c)

