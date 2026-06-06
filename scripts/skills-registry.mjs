#!/usr/bin/env node
/**
 * AirMentor Skills Registry
 * SOTA 2026: Discovers and integrates skills from Windsurf, Claude Code, Cursor
 * Inspired by: Windsurf Skills (progressive disclosure), Claude Code Skills Marketplace
 *
 * Skills are reusable multi-step workflows with supporting files.
 * Windsurf uses progressive disclosure: only name+description in context,
 * full SKILL.md loaded only when invoked.
 *
 * Discovery paths:
 *   - .windsurf/skills/           (project-specific)
 *   - ~/.codeium/windsurf/skills/ (global)
 *   - .claude/skills/             (Claude Code)
 *   - ~/.claude/skills/           (Claude Code global)
 *   - .cursor/skills/             (Cursor)
 *   - ~/.cursor/skills/           (Cursor global)
 *
 * Usage:
 *   node scripts/skills-registry.mjs --discover
 *   node scripts/skills-registry.mjs --list
 *   node scripts/skills-registry.mjs --invoke <skill-name> --context <task.json>
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SKILL_DISCOVERY_PATHS = [
  // Windsurf
  path.join(repoRoot, '.windsurf', 'skills'),
  path.join(homedir(), '.codeium', 'windsurf', 'skills'),
  // Claude Code
  path.join(repoRoot, '.claude', 'skills'),
  path.join(homedir(), '.claude', 'skills'),
  // Cursor
  path.join(repoRoot, '.cursor', 'skills'),
  path.join(homedir(), '.cursor', 'skills'),
  // Generic agent skills
  path.join(repoRoot, '.agents', 'skills'),
  path.join(homedir(), '.agents', 'skills'),
]

function parseSkillMetadata(skillDir) {
  const skillMdPath = path.join(skillDir, 'SKILL.md')
  if (!existsSync(skillMdPath)) return null

  const content = readFileSync(skillMdPath, 'utf8')

  // Parse YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (!frontmatterMatch) return null

  const frontmatter = frontmatterMatch[1]
  const metadata = {}

  for (const line of frontmatter.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)/)
    if (match) metadata[match[1]] = match[2].trim()
  }

  // Extract the markdown body
  const body = content.slice(frontmatterMatch[0].length)

  // Find supporting files
  const supportingFiles = []
  try {
    const entries = readdirSync(skillDir)
    for (const entry of entries) {
      if (entry === 'SKILL.md') continue
      const entryPath = path.join(skillDir, entry)
      const stat = statSync(entryPath)
      if (stat.isFile()) {
        supportingFiles.push({
          name: entry,
          path: entryPath,
          size: stat.size,
        })
      }
    }
  } catch {}

  return {
    name: metadata.name || path.basename(skillDir),
    description: metadata.description || '',
    version: metadata.version || '1.0.0',
    author: metadata.author || 'unknown',
    tags: metadata.tags ? metadata.tags.split(',').map(t => t.trim()) : [],
    scope: metadata.scope || 'workspace',
    sourceDir: skillDir,
    body: body.slice(0, 2000), // Truncate for discovery
    supportingFiles,
    fullContent: content,
  }
}

function discoverSkills() {
  const skills = []

  for (const basePath of SKILL_DISCOVERY_PATHS) {
    if (!existsSync(basePath)) continue

    try {
      const entries = readdirSync(basePath)
      for (const entry of entries) {
        const skillDir = path.join(basePath, entry)
        const stat = statSync(skillDir)
        if (!stat.isDirectory()) continue

        const skill = parseSkillMetadata(skillDir)
        if (skill) {
          skill.discoveredFrom = basePath
          skills.push(skill)
        }
      }
    } catch (err) {
      // Permission errors or missing dirs are OK
    }
  }

  return skills
}

function generateSkillIndex(skills) {
  const lines = [
    '# AirMentor Skills Index',
    '',
    '> Auto-generated from discovered skills across Windsurf, Claude Code, Cursor',
    '> This index uses progressive disclosure: only name+description shown to agents by default.',
    '> Full SKILL.md loaded only when skill is invoked.',
    '',
    `**Total skills discovered:** ${skills.length}`,
    `**Sources:** Windsurf, Claude Code, Cursor, Generic agent skills`,
    '',
    '## Skills by Category',
    '',
  ]

  // Group by tags
  const byTag = {}
  const untagged = []

  for (const skill of skills) {
    if (skill.tags.length === 0) {
      untagged.push(skill)
      continue
    }
    for (const tag of skill.tags) {
      if (!byTag[tag]) byTag[tag] = []
      byTag[tag].push(skill)
    }
  }

  for (const [tag, tagSkills] of Object.entries(byTag).sort()) {
    lines.push(`### ${tag}`)
    lines.push('')
    for (const skill of tagSkills) {
      lines.push(`- **${skill.name}** — ${skill.description}`)
      lines.push(`  Scope: ${skill.scope} | Source: ${path.basename(skill.discoveredFrom)} | Files: ${skill.supportingFiles.length}`)
    }
    lines.push('')
  }

  if (untagged.length > 0) {
    lines.push('### Untagged')
    lines.push('')
    for (const skill of untagged) {
      lines.push(`- **${skill.name}** — ${skill.description}`)
    }
    lines.push('')
  }

  lines.push('## How to Invoke a Skill')
  lines.push('')
  lines.push('In your orchestrator or agent prompt:')
  lines.push('```')
  lines.push('You have access to the following skills. Use them when relevant:')
  for (const skill of skills.slice(0, 20)) {
    lines.push(`- ${skill.name}: ${skill.description.slice(0, 100)}`)
  }
  if (skills.length > 20) lines.push(`- ... and ${skills.length - 20} more`)
  lines.push('```')
  lines.push('')
  lines.push('To fully load a skill, read its SKILL.md and supporting files.')

  return lines.join('\n')
}

function invokeSkill(skillName, skills) {
  const skill = skills.find(s => s.name === skillName)
  if (!skill) {
    return { error: `Skill "${skillName}" not found` }
  }

  // Progressive disclosure: return full content when invoked
  const result = {
    name: skill.name,
    description: skill.description,
    fullContent: skill.fullContent,
    supportingFiles: skill.supportingFiles.map(f => ({
      name: f.name,
      path: f.path,
      preview: existsSync(f.path)
        ? readFileSync(f.path, 'utf8').slice(0, 1000)
        : '(file not readable)',
    })),
  }

  return result
}

// CLI
const action = process.argv[2]

if (action === '--discover') {
  const skills = discoverSkills()
  const index = generateSkillIndex(skills)

  const indexPath = path.join(repoRoot, '.audit', 'SKILLS_INDEX.md')
  const skillsJsonPath = path.join(repoRoot, '.audit', 'skills-registry.json')

  // Write index
  // Note: We don't write SKILL.md files, we only discover existing ones
  console.log(index)
  console.log('')
  console.log(`Discovered ${skills.length} skills`)
  console.log(`Sources scanned:`)
  for (const p of SKILL_DISCOVERY_PATHS) {
    const exists = existsSync(p) ? 'EXISTS' : 'NOT FOUND'
    console.log(`  ${exists}: ${p}`)
  }
} else if (action === '--list') {
  const skills = discoverSkills()
  console.log('=== Discovered Skills ===')
  for (const skill of skills) {
    console.log(`- ${skill.name}`)
    console.log(`  ${skill.description.slice(0, 100)}`)
    console.log(`  Tags: ${skill.tags.join(', ') || 'none'}`)
    console.log(`  From: ${skill.discoveredFrom}`)
    console.log(`  Files: ${skill.supportingFiles.map(f => f.name).join(', ')}`)
    console.log('')
  }
  console.log(`Total: ${skills.length} skills`)
} else if (action === '--invoke') {
  const skillName = process.argv[3]
  if (!skillName) {
    console.error('Usage: --invoke <skill-name>')
    process.exit(1)
  }
  const skills = discoverSkills()
  const result = invokeSkill(skillName, skills)
  console.log(JSON.stringify(result, null, 2))
} else if (action === '--paths') {
  console.log('Skill discovery paths:')
  for (const p of SKILL_DISCOVERY_PATHS) {
    const exists = existsSync(p)
    console.log(`  ${exists ? 'EXISTS' : 'MISSING'}: ${p}`)
  }
} else {
  console.log(`AirMentor Skills Registry

Usage:
  --discover     Scan all skill directories and generate index
  --list         List all discovered skills with metadata
  --invoke <name> Load full content of a specific skill
  --paths        Show all discovery paths and their status

Discovery paths checked:
  - .windsurf/skills/           (project-specific)
  - ~/.codeium/windsurf/skills/ (global)
  - .claude/skills/             (Claude Code project)
  - ~/.claude/skills/           (Claude Code global)
  - .cursor/skills/             (Cursor project)
  - ~/.cursor/skills/           (Cursor global)
  - .agents/skills/             (Generic)
  - ~/.agents/skills/           (Generic global)

Progressive disclosure: Only name+description loaded into context.
Full SKILL.md loaded only when skill is explicitly invoked.`)
}
