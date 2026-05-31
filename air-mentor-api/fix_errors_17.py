import re
with open('src/lib/msruas-proof-sandbox.ts', 'r') as f:
    c = f.read()

c = re.sub(r'ceMark,\s*seeMark:\s*generatedSeeMark,', 'componentScores: { ce: ceMark, see: generatedSeeMark },', c)
c = re.sub(r'ceMark,\s*componentScores:\s*\{\s*see:\s*0\s*\},', 'componentScores: { ce: ceMark, see: 0 },', c)

with open('src/lib/msruas-proof-sandbox.ts', 'w') as f:
    f.write(c)

