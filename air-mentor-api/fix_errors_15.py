import re

with open('src/lib/msruas-proof-control-plane.ts', 'r') as f:
    c = f.read()

c = re.sub(r'ceMark,\n\s*seeMark:\s*generatedSeeMark,', 'componentScores: { ce: ceMark, see: generatedSeeMark },', c)
c = re.sub(r'ceMark,\n\s*componentScores:\s*\{\s*see:\s*0\s*\},', 'componentScores: { ce: ceMark, see: 0 },', c)

with open('src/lib/msruas-proof-control-plane.ts', 'w') as f:
    f.write(c)

with open('src/lib/msruas-proof-sandbox.ts', 'r') as f:
    c = f.read()

c = re.sub(r'ceMark,\n\s*seeMark:\s*generatedSeeMark,', 'componentScores: { ce: ceMark, see: generatedSeeMark },', c)
c = re.sub(r'ceMark,\n\s*componentScores:\s*\{\s*see:\s*0\s*\},', 'componentScores: { ce: ceMark, see: 0 },', c)

# And line 1438: Argument of type '{ course...}' is missing ceMark, seeMark
# The issue is that the type expects ceMark and seeMark. Let's see what it's passing exactly.
