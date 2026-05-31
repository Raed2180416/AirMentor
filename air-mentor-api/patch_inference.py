with open('src/lib/inference-engine.ts', 'r') as f:
    content = f.read()
content = content.replace("riskRules.highRiskBacklogCredits", "riskRules.highRiskBacklogCount")
content = content.replace("riskRules.mediumRiskBacklogCredits", "riskRules.mediumRiskBacklogCount")
content = content.replace("backlogCredits >=", "input.backlogCount >=")
with open('src/lib/inference-engine.ts', 'w') as f:
    f.write(content)
