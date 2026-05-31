import os
import re

def fix_admin_offerings(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # tt1Locked: offering.tt1Locked -> removed
    content = re.sub(r'tt\dLocked:\s*offering\.tt\dLocked,?', '', content)
    content = re.sub(r'tt\dLocked:\s*body\.tt\dLocked\s*\?\s*1\s*:\s*0,?', '', content)
    content = re.sub(r'stagePatch\.tt\dLocked\s*=\s*0', '', content)
    
    # property 'tt1Done'
    content = re.sub(r'tt\dDone:\s*0,?', '', content)
    
    with open(filepath, 'w') as f:
        f.write(content)
fix_admin_offerings('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/modules/academic-admin-offerings-routes.ts')

def fix_academic_runtime(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    # "tt1Locked" | "tt2Locked" | "quizLocked" | "finalsLocked" | "assignmentLocked"
    content = re.sub(r'\?\s*\'tt1Locked\'', "? 'componentStatesJson'", content)
    # in 1592, 1379
    content = re.sub(r'const\s+stateKey\s*=\s*offering\[\w+\]', 'const stateKey = offering.componentStatesJson', content)
    content = re.sub(r'offering\[flagName\]', 'offering.componentStatesJson', content)
    content = re.sub(r'patch\[flagName\]\s*=\s*1', 'patch.componentStatesJson = "{}"', content)
    with open(filepath, 'w') as f:
        f.write(content)
fix_academic_runtime('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/modules/academic-runtime-routes.ts')

def fix_academic(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    content = re.sub(r'sgpaScaled:\s*termResult\.sgpaScaled\s*/\s*100', 'sgpaScaled: JSON.parse(termResult.termMetricsJson).sgpaScaled / 100', content)
    content = re.sub(r'sgpaScaled:\s*(\w+)\.sgpaScaled,?', r'sgpaScaled: JSON.parse(\1.termMetricsJson).sgpaScaled,', content)
    content = re.sub(r'sgpa:\s*termResult\.sgpaScaled\s*/\s*100', 'sgpa: JSON.parse(termResult.termMetricsJson).sgpaScaled / 100', content)
    content = re.sub(r'tt1Done:\s*!!input\.offering\.tt1Done,?', '', content)
    content = re.sub(r'tt2Done:\s*!!input\.offering\.tt2Done,?', '', content)
    content = re.sub(r'tt1Done:\s*false,?', '', content)
    content = re.sub(r'tt2Done:\s*false,?', '', content)
    content = re.sub(r'offering\.tt1Done\s*\?\s*1\s*:\s*0', '0', content)
    content = re.sub(r'offering\.tt2Done\s*\?\s*1\s*:\s*0', '0', content)
    content = re.sub(r'offering\.tt1Locked\s*\?\s*1\s*:\s*0', '0', content)
    content = re.sub(r'offering\.tt2Locked\s*\?\s*1\s*:\s*0', '0', content)
    content = re.sub(r'offering\.quizLocked\s*\?\s*1\s*:\s*0', '0', content)
    content = re.sub(r'offering\.asgnLocked\s*\?\s*1\s*:\s*0', '0', content)
    content = re.sub(r'offering\.finalsLocked\s*\?\s*1\s*:\s*0', '0', content)
    content = re.sub(r'locked:\s*!!offering\.tt1Locked,?', '', content)
    content = re.sub(r'locked:\s*!!offering\.tt2Locked,?', '', content)
    content = re.sub(r'locked:\s*!!offering\.quizLocked,?', '', content)
    content = re.sub(r'locked:\s*!!offering\.assignmentLocked,?', '', content)
    content = re.sub(r'locked:\s*!!offering\.finalsLocked,?', '', content)
    # remove locked from type 
    content = re.sub(r'locked:\s*boolean', '', content)
    content = re.sub(r'locked:\s*false,?', '', content)
    with open(filepath, 'w') as f:
        f.write(content)
fix_academic('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/modules/academic.ts')

def fix_tests(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    # We remove any stray .where(...) if the line only starts with .where
    out = []
    for line in lines:
        if line.strip().startswith('.where(') and not out[-1].strip().startswith('.'):
            # probably broken
            pass
        elif line.strip() == '.where(eq(sectionOfferings.offeringId, offeringId))':
            if out[-1].strip() == '.set({ stage: 1 })' or 'set(' in out[-1]:
                out[-1] = out[-1].rstrip() + line
            else:
                out[-1] = out[-1].rstrip() + ' ' + line
        else:
            out.append(line)

    with open(filepath, 'w') as f:
        f.writelines(out)
fix_tests('/home/raed/Projects/air-mentor-ui/air-mentor-api/tests/gap-closure-intent.test.ts')
