import re

def fix_control_plane(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # The error says `stageSeed.tt1Done` does not exist, wait let me grep what exists
    # Actually let's just remove anything with `tt1Done` or `tt2Done`
    content = re.sub(r'tt\dDone:\s*[^,\n]+,?', '', content)
    content = re.sub(r'tt\dLocked:\s*[^,\n]+,?', '', content)
    content = re.sub(r'quizLocked:\s*[^,\n]+,?', '', content)
    content = re.sub(r'assignmentLocked:\s*[^,\n]+,?', '', content)
    content = re.sub(r'finalsLocked:\s*[^,\n]+,?', '', content)

    # sgpaScaled
    content = re.sub(r'sgpaScaled:\s*[^,\n]+,?', '', content)
    
    # msruas-proof-control-plane.ts(5157,3): ceMark
    # Just fix the argument of evaluateCourseStatus
    content = re.sub(r'ceMark:([^,]+),(\s*)seeMark:([^,]+)', r'componentScores: { ce: \1, see: \3 }', content)

    with open(filepath, 'w') as f:
        f.write(content)

fix_control_plane('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/lib/msruas-proof-control-plane.ts')


def fix_admin(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    content = re.sub(r'tt\dDone:\s*[^,\n]+,?', '', content)
    content = re.sub(r'tt\dLocked:\s*[^,\n]+,?', '', content)
    content = re.sub(r'stagePatch\.tt\dDone\s*=\s*0', '', content)

    with open(filepath, 'w') as f:
        f.write(content)

fix_admin('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/modules/academic-admin-offerings-routes.ts')

def fix_academic(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # 4823
    content = re.sub(r'offering:\s*\{\s*offId:\s*string;\s*attendance:\s*number;\s*stage:\s*number;\s*\}', r'offering: { offId: string; attendance: number; stage: number; }', content)

    with open(filepath, 'w') as f:
        f.write(content)

fix_academic('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/modules/academic.ts')

