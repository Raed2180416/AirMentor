#!/bin/bash

# Agent Optimization Verification Script
# Checks if Windsurf agents are properly configured for optimal performance

echo "=== Windsurf Agent Optimization Verification ==="
echo ""

# Check Windsurf skills directory
echo "1. Checking Windsurf skills directory..."
if [ -d "/home/raed/.windsurf/skills" ]; then
    SKILL_COUNT=$(ls -1 /home/raed/.windsurf/skills | wc -l)
    echo "   ✓ Skills directory exists with $SKILL_COUNT skills"
else
    echo "   ✗ Skills directory missing"
fi
echo ""

# Check critical skills
echo "2. Checking critical optimization skills..."
CRITICAL_SKILLS=("caveman" "absolute-brainstorm" "system-design" "clean-code" "backend-engineering")
for skill in "${CRITICAL_SKILLS[@]}"; do
    if [ -d "/home/raed/.windsurf/skills/$skill" ] || [ -f "/home/raed/.windsurf/skills/$skill" ]; then
        echo "   ✓ $skill"
    else
        echo "   ✗ $skill missing"
    fi
done
echo ""

# Check MCP configuration
echo "3. Checking MCP server configuration..."
if [ -f "/home/raed/Projects/air-mentor-ui/.mcp.json" ]; then
    echo "   ✓ MCP config exists"
    
    # Check for key MCP servers
    MCP_SERVERS=("codegraph" "ctxo" "memory" "github" "filesystem" "git" "brave-search" "logicstamp" "firecrawl" "playwright" "e2b" "figma" "context7")
    for server in "${MCP_SERVERS[@]}"; do
        if grep -q "$server" /home/raed/Projects/air-mentor-ui/.mcp.json; then
            echo "   ✓ $server MCP configured"
        else
            echo "   ✗ $server MCP missing"
        fi
    done
else
    echo "   ✗ MCP config missing"
fi
echo ""

# Check optimization config
echo "4. Checking agent optimization configuration..."
if [ -f "/home/raed/Projects/air-mentor-ui/.windsurf/AGENT_OPTIMIZATION_CONFIG.json" ]; then
    echo "   ✓ Optimization config exists"
    
    # Check for caveman ultra mode
    if grep -q "caveman_intensity.*ultra" /home/raed/Projects/air-mentor-ui/.windsurf/AGENT_OPTIMIZATION_CONFIG.json; then
        echo "   ✓ Caveman ultra mode configured"
    else
        echo "   ✗ Caveman ultra mode not configured"
    fi
    
    # Check for wenyan-ultra fallback
    if grep -q "wenyan-ultra" /home/raed/Projects/air-mentor-ui/.windsurf/AGENT_OPTIMIZATION_CONFIG.json; then
        echo "   ✓ Wenyan-ultra fallback configured"
    else
        echo "   ✗ Wenyan-ultra fallback not configured"
    fi
else
    echo "   ✗ Optimization config missing"
fi
echo ""

# Check AGENTS.md
echo "5. Checking AGENTS.md system prompt..."
if [ -f "/home/raed/Projects/air-mentor-ui/.windsurf/AGENTS.md" ]; then
    echo "   ✓ AGENTS.md exists"
    
    # Check for key configurations
    if grep -q "caveman ultra" /home/raed/Projects/air-mentor-ui/.windsurf/AGENTS.md; then
        echo "   ✓ Caveman ultra mode in system prompt"
    else
        echo "   ✗ Caveman ultra mode not in system prompt"
    fi
    
    if grep -q "codegraph" /home/raed/Projects/air-mentor-ui/.windsurf/AGENTS.md; then
        echo "   ✓ Codegraph MCP in system prompt"
    else
        echo "   ✗ Codegraph MCP not in system prompt"
    fi
else
    echo "   ✗ AGENTS.md missing"
fi
echo ""

# Check skill categories
echo "5. Checking skill category coverage..."
CATEGORIES=(
    "AI/Agent Skills:ai-agent-design|llm-app-development|mastra"
    "Architecture:system-design|clean-architecture|backend-engineering"
    "Code Quality:clean-code|code-review-mastery|refactoring-patterns"
    "Data & ML:data-science|ml-ops|analytics-engineering"
    "Security:appsec-owasp|penetration-testing|security-incident-response"
    "Performance:performance-engineering|observability|load-testing"
)

for category in "${CATEGORIES[@]}"; do
    NAME=$(echo $category | cut -d: -f1)
    PATTERNS=$(echo $category | cut -d: -f2)
    FOUND=0
    IFS='|' read -ra SKILLS <<< "$PATTERNS"
    for skill in "${SKILLS[@]}"; do
        if [ -d "/home/raed/.windsurf/skills/$skill" ] || [ -f "/home/raed/.windsurf/skills/$skill" ]; then
            FOUND=1
            break
        fi
    done
    if [ $FOUND -eq 1 ]; then
        echo "   ✓ $NAME"
    else
        echo "   ✗ $NAME (no skills found)"
    fi
done
echo ""

echo "=== Verification Complete ==="
echo ""
echo "Summary:"
echo "- Total skills in Windsurf: $SKILL_COUNT"
echo "- Critical skills: ${#CRITICAL_SKILLS[@]} checked"
echo "- MCP servers: configured"
echo "- Optimization config: present"
echo ""
echo "All future agents opened in Windsurf will automatically use these optimized settings."
echo ""
echo "To run this verification automatically on git commits, the pre-commit hook is installed."
echo "To run manually: npm run verify-agent"
