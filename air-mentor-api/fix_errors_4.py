import os
import re

def fix_control_plane(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    content = re.sub(r'tt1Done:\s*stageSeed\.tt1Done,?', '', content)
    content = re.sub(r'tt2Done:\s*stageSeed\.tt2Done,?', '', content)
    content = re.sub(r'tt1Locked:\s*stageSeed\.tt1Locked,?', '', content)
    content = re.sub(r'tt2Locked:\s*stageSeed\.tt2Locked,?', '', content)
    content = re.sub(r'quizLocked:\s*stageSeed\.quizLocked,?', '', content)
    content = re.sub(r'assignmentLocked:\s*stageSeed\.assignmentLocked,?', '', content)
    content = re.sub(r'finalsLocked:\s*stageSeed\.finalsLocked,?', '', content)

    content = re.sub(r'tt1Done:\s*stageSeed\?\.tt1Done\s*\?\s*1\s*:\s*0,?', '', content)
    content = re.sub(r'tt2Done:\s*stageSeed\?\.tt2Done\s*\?\s*1\s*:\s*0,?', '', content)
    content = re.sub(r'tt1Locked:\s*stageSeed\?\.tt1Locked\s*\?\s*1\s*:\s*0,?', '', content)
    content = re.sub(r'tt2Locked:\s*stageSeed\?\.tt2Locked\s*\?\s*1\s*:\s*0,?', '', content)
    content = re.sub(r'quizLocked:\s*stageSeed\?\.quizLocked\s*\?\s*1\s*:\s*0,?', '', content)
    content = re.sub(r'assignmentLocked:\s*stageSeed\?\.assignmentLocked\s*\?\s*1\s*:\s*0,?', '', content)
    content = re.sub(r'finalsLocked:\s*stageSeed\?\.finalsLocked\s*\?\s*1\s*:\s*0,?', '', content)

    content = re.sub(r'sgpaScaled:\s*termResult\.sgpaScaled,', r'termMetricsJson: JSON.stringify({ sgpaScaled: termResult.sgpaScaled }),', content)

    # In 5157: `evaluateCourseStatus` assignment is not assignable. Wait, evaluateCourseStatus is imported and then assigned to a variable maybe?
    # Actually, in msruas-proof-control-plane.ts, `const evaluator = evaluateCourseStatus` or something?
    # It might be `const ruleFn: (input: { attendancePercent: number; ceMark: number; seeMark: number; policy: GenericGradingSchema; }) => ... = evaluateCourseStatus`
    content = re.sub(r'ceMark:\s*number;\s*seeMark:\s*number;', r'componentScores: Record<string, number>; condoned?: boolean;', content)

    with open(filepath, 'w') as f:
        f.write(content)

fix_control_plane('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/lib/msruas-proof-control-plane.ts')

def fix_sandbox(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # ceComponentCaps -> components: []
    content = re.sub(r'ceComponentCaps: {.*?},', "components: [\n      { code: 'ce', name: 'CE', maxScore: 50, weight: 50 },\n      { code: 'see', name: 'SEE', maxScore: 50, weight: 50, isSee: true }\n    ],", content, flags=re.DOTALL)
    
    # ceMark and seeMark
    content = re.sub(r'ceMark:\s*([\d\.]+)', r'componentScores: { ce: \1 }', content)
    content = re.sub(r'seeMark:\s*([\d\.]+)', r'componentScores: { see: \1 }', content)
    content = re.sub(r'componentScores:\s*\{\s*ce:\s*([\d\.]+)\s*\},\s*componentScores:\s*\{\s*see:\s*([\d\.]+)\s*\}', r'componentScores: { ce: \1, see: \2 }', content)

    # Missing components / progressionGates in deterministic policy
    content = re.sub(r'sgpaScaled:\s*term\.sgpaScaled,', r'termMetricsJson: JSON.stringify({ sgpaScaled: term.sgpaScaled }),', content)

    with open(filepath, 'w') as f:
        f.write(content)

fix_sandbox('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/lib/msruas-proof-sandbox.ts')

