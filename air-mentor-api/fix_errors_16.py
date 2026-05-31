with open('src/lib/msruas-proof-sandbox.ts', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "seePct: simulation.seePct," in line:
        # Check if the next few lines are empty, we can just insert ceMark, seeMark
        lines.insert(i + 1, "          ceMark: simulation.ceMark,\n          seeMark: simulation.seeMark,\n")
        break

with open('src/lib/msruas-proof-sandbox.ts', 'w') as f:
    f.writelines(lines)
