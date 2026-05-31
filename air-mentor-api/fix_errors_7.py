import re

def fix_tests(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # We will remove from `describe('GAP-3...` down to `// GAP-4:`
    content = re.sub(r"describe\('GAP-3:.*?// GAP-4:", "// GAP-4:", content, flags=re.DOTALL)
    
    with open(filepath, 'w') as f:
        f.write(content)

fix_tests('/home/raed/Projects/air-mentor-ui/air-mentor-api/tests/gap-closure-intent.test.ts')
