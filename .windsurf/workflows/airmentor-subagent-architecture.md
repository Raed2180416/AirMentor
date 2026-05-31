---
description: AirMentor subagent architecture and parallelization workflow for Windsurf
---

# AirMentor Subagent Architecture Workflow

## Overview

This workflow defines how to use Windsurf's subagent capabilities for AirMentor project tasks, including parallelization, model selection, and error handling.

## Windsurf Subagent Capabilities

### What IS Supported

**Workflows:**
- Stored as markdown files in `.windsurf/workflows/`
- Define step-by-step tasks for Cascade to follow
- Can call other workflows (e.g., `/workflow-1` can call `/workflow-2`)
- Limited to 12,000 characters per workflow file
- Discovered from: workspace `.windsurf/workflows/`, subdirectories, and git root

**Devin Local Subagents:**
- Can spawn independent subagents for subtasks (foreground or background)
- Subagents share tools and codebase context with parent agent
- Operate in their own conversation chain
- Support OS-level sandboxing (filesystem isolation, network filtering)
- Custom subagent profiles can be defined in `.devin/agents/` or `~/.config/devin/agents/`

**Custom Subagent Configuration:**
- AGENT.md files with frontmatter fields:
  - `name`: Subagent identifier
  - `description`: What the subagent does
  - `model`: Model to use (e.g., `sonnet`, `opus`, `swe`)
  - `allowed-tools`: List of permitted tools
  - `permissions`: Allow/deny rules for specific operations
  - `max-nesting`: Maximum nesting depth

### What IS NOT Currently Supported

**Model Configuration Limitations:**
- AGENT.md `model` field uses simple names (sonnet, opus, swe, codex)
- No documented support for custom model names like "kimi-k2.6" or "deepseek-v4-pro"
- BYOK (Bring Your Own Key) is mentioned but specific configuration for Kimi/DeepSeek is not documented
- No documented way to configure infinite retry logic at the subagent level
- No documented way to configure state persistence for resume capability after account switch

**Retry/Error Handling:**
- No built-in infinite retry mechanism
- No documented way to implement "0 retries in a row max then print 'change account and try again'"
- No documented way to persist subagent state across account switches

**Parallelization:**
- Devin Local can spawn subagents in foreground or background
- No documented way to configure specific parallelization strategies for AirMentor
- No documented way to coordinate multiple subagents on the same task

## BYOK (Bring Your Own Key) Configuration

### Supported BYOK Models

Windsurf currently supports BYOK for these models only:
- Claude 4 Sonnet
- Claude 4 Sonnet (Thinking)
- Claude 4 Opus
- Claude 4 Opus (Thinking)

**Kimi K2.6 and DeepSeek V4 Pro are NOT supported via BYOK.**

### How to Configure BYOK

1. Navigate to https://windsurf.com/subscription/provider-api-keys
2. Add your API key for the supported model
3. Select the BYOK model from the dropdown in Cascade

### Current Limitations Summary

Based on official Windsurf documentation:

1. **Model Selection**: Cannot configure subagents to use Kimi K2.6 or DeepSeek V4 Pro specifically. The `model` field in AGENT.md only supports predefined model names (sonnet, opus, swe, codex). BYOK only supports Claude models.

2. **Infinite Retry**: No built-in mechanism for infinite retry with error handling. Would require custom implementation outside of Windsurf's configuration.

3. **State Persistence**: No documented way to persist subagent state across account switches for resume capability.

4. **BYOK Configuration**: BYOK is only available for Claude 4 Sonnet/Opus models. Kimi K2.6 and DeepSeek V4 Pro are not supported.

## Recommended Approach

Given these limitations, the following approach is recommended:

### Option 1: Use SWE (Recommended - Native, No API Key Required)
Configure subagents to use SWE (Windsurf's in-house model family). SWE is included with Windsurf and requires no API keys or BYOK configuration. This is the recommended approach for AirMentor subagents.

### Option 2: Request Feature
Request Windsurf to add support for:
- Custom model names in AGENT.md
- Configurable retry logic
- State persistence for subagents
- BYOK configuration documentation for specific models

### Option 3: External Scripting
Implement retry logic and state persistence through external scripts that:
- Monitor subagent execution
- Retry on failure
- Persist state to files
- Resume after account switch

## Example Custom Subagent (Using Available Models)

```yaml
---
name: airmentor-ml-researcher
description: Handles ML research tasks for AirMentor
model: sonnet
allowed-tools:
  - read
  - write
  - grep
  - exec
permissions:
  allow:
    - Exec(python*)
    - Exec(npm*)
  deny:
    - Exec(rm -rf *)
---

You are an ML research subagent for AirMentor. Your job is to:
1. Analyze ML training scripts and pipelines
2. Review model performance metrics
3. Suggest improvements to training configurations
4. Validate synthetic data quality

Always cite specific file paths and line numbers in your findings.
```

## Workflow Steps

When using subagents for AirMentor tasks:

1. **Define the subagent profile** in `.devin/agents/airmentor-ml-researcher/AGENT.md`
2. **Invoke the subagent** from the main agent using the subagent's name
3. **Monitor progress** through the Windsurf UI subagent panel
4. **Collect results** from the subagent's conversation chain

## Storage Locations

**Project-specific subagents:**
- `.devin/agents/<subagent-name>/AGENT.md`

**Global subagents:**
- Linux/macOS: `~/.config/devin/agents/<subagent-name>/AGENT.md`
- Windows: `%APPDATA%\devin\agents\<subagent-name>\AGENT.md`

## References

- Windsurf Workflows: https://docs.windsurf.com/windsurf/cascade/workflows
- Devin Local Subagents: https://docs.windsurf.com/windsurf/devin-local
- Devin CLI Subagents: https://cli.devin.ai/docs/subagents
- AI Models (BYOK): https://docs.windsurf.com/windsurf/models
