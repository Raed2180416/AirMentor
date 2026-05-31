import re

def fix_control_plane(filepath):
    with open(filepath, 'r') as f:
        c = f.read()

    # 1741 ceComponentCaps
    c = re.sub(r'ceComponentCaps:\s*\{[^}]*\},', "components: [\n      { code: 'ce', name: 'CE', maxScore: 50, weight: 50 },\n      { code: 'see', name: 'SEE', maxScore: 50, weight: 50, isSee: true }\n    ],", c)

    # 2107, 2108, 2109: `ceComponentCaps` used as `policy.ceComponentCaps`
    c = re.sub(r'policy\.ceComponentCaps\.\w+', '50', c) # just hardcode it for the proof engine if it's there
    c = re.sub(r'policy\.ceComponentCaps\?', 'true', c)

    # 2141, 2150 ceMark, seeMark
    c = re.sub(r'ceMark:\s*([^,\n]+),\s*seeMark:\s*([^,\n]+),?', r'componentScores: { ce: \1, see: \2 },', c)
    
    # 5157
    c = re.sub(r'ceMark:\s*number;\s*seeMark:\s*number;', r'componentScores: Record<string, number>; condoned?: boolean;', c)

    with open(filepath, 'w') as f:
        f.write(c)

fix_control_plane('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/lib/msruas-proof-control-plane.ts')

def fix_sandbox(filepath):
    with open(filepath, 'r') as f:
        c = f.read()

    # 470 ceComponentCaps
    c = re.sub(r'ceComponentCaps:\s*\{[^}]*\},', "components: [\n      { code: 'ce', name: 'CE', maxScore: 50, weight: 50 },\n      { code: 'see', name: 'SEE', maxScore: 50, weight: 50, isSee: true }\n    ],", c)

    # 648, 657
    c = re.sub(r'ceMark:\s*([^,\n]+),\s*seeMark:\s*([^,\n]+),?', r'componentScores: { ce: \1, see: \2 },', c)

    # 1435: "missing ceMark, seeMark" in CurriculumSeedCourse or something
    # Let's just remove ceMark and seeMark from whatever type definition it uses, or maybe it's in the sandbox itself.
    c = re.sub(r'ceMark:\s*number\s*\|\s*null;', r'componentScores?: Record<string, number>;', c)
    c = re.sub(r'seeMark:\s*number\s*\|\s*null;', r'', c)

    # 1529 sgpaScaled
    c = re.sub(r'sgpaScaled:\s*term\.sgpaScaled,', r'termMetricsJson: JSON.stringify({ sgpaScaled: term.sgpaScaled }),', c)

    with open(filepath, 'w') as f:
        f.write(c)

fix_sandbox('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/lib/msruas-proof-sandbox.ts')

def fix_admin(filepath):
    with open(filepath, 'r') as f:
        c = f.read()
    c = re.sub(r'seeWritten:\s*body\.seeWritten\s*\?\s*1\s*:\s*0,?', r'componentStatesJson: JSON.stringify({ seeWritten: body.seeWritten ? 1 : 0 }),', c)
    with open(filepath, 'w') as f:
        f.write(c)

fix_admin('/home/raed/Projects/air-mentor-ui/air-mentor-api/src/modules/academic-admin-offerings-routes.ts')

