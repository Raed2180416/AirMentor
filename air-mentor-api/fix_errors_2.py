import os
import re

def fix_msruas(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    # It currently looks like:
    # componentScores: { ce: 24 },
    # componentScores: { see: 35 },
    # I want to merge them to: componentScores: { ce: 24, see: 35 }
    # Let's use regex
    content = re.sub(r'componentScores:\s*\{\s*ce:\s*([\d\.]+)\s*\},\s*componentScores:\s*\{\s*see:\s*([\d\.]+)\s*\}', r'componentScores: { ce: \1, see: \2 }', content)
    with open(filepath, 'w') as f:
        f.write(content)

fix_msruas('/home/raed/Projects/air-mentor-ui/air-mentor-api/tests/msruas-proof-engines.test.ts')

def fix_academic(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    # tt1Locked: !!input.offering.tt1Locked -> removed or replaced
    content = re.sub(r'tt1Done:\s*!!input\.offering\.tt1Done,?', '', content)
    content = re.sub(r'tt2Done:\s*!!input\.offering\.tt2Done,?', '', content)
    content = re.sub(r'tt1Locked:\s*!!input\.offering\.tt1Locked,?', '', content)
    content = re.sub(r'tt2Locked:\s*!!input\.offering\.tt2Locked,?', '', content)
    content = re.sub(r'quizLocked:\s*!!input\.offering\.quizLocked,?', '', content)
    content = re.sub(r'asgnLocked:\s*!!input\.offering\.assignmentLocked,?', '', content)
    content = re.sub(r'finalsLocked:\s*!!input\.offering\.finalsLocked,?', '', content)
    
    # locked: !!offering.tt1Locked
    content = re.sub(r'locked:\s*!!offering\.tt1Locked,?', '', content)
    content = re.sub(r'locked:\s*!!offering\.tt2Locked,?', '', content)
    content = re.sub(r'locked:\s*!!offering\.quizLocked,?', '', content)
    content = re.sub(r'locked:\s*!!offering\.assignmentLocked,?', '', content)
    content = re.sub(r'locked:\s*!!offering\.finalsLocked,?', '', content)

    # termResult.sgpaScaled / 100
    content = re.sub(r'termResult\.sgpaScaled\s*/\s*100', 'JSON.parse(termResult.termMetricsJson).sgpaScaled / 100', content)

    with open(filepath, 'w') as f:
        f.write(content)

fix_academic('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/modules/academic.ts')

def fix_tests(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    # .from(sectionOfferings) -> remove if preceding select was removed incorrectly
    # Wait, in gap-closure-intent:
    # .select({ tt1Locked: sectionOfferings.tt1Locked }) was removed, so there is empty lines then .from(sectionOfferings)
    content = re.sub(r'\n\s*\.from\(sectionOfferings\)', '', content)
    with open(filepath, 'w') as f:
        f.write(content)

fix_tests('/home/raed/Projects/air-mentor-ui/air-mentor-api/tests/gap-closure-intent.test.ts')

def fix_offering(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    content = re.sub(r'tt1Done:\s*offering!\.tt1Done\s*===\s*1,?', '', content)
    content = re.sub(r'tt2Done:\s*offering!\.tt2Done\s*===\s*1,?', '', content)
    with open(filepath, 'w') as f:
        f.write(content)

fix_offering('/home/raed/Projects/air-mentor-ui/air-mentor-api/tests/academic-admin-offerings.test.ts')

