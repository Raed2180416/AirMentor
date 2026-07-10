#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const SOURCE_ROOT = resolve(process.cwd(), 'src')
const RATCHET_PATH = resolve(process.cwd(), 'docs/architecture-line-ratchet.json')
const MAX_NEW_PRODUCTION_FILE_LINES = 400
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

function readRatchet() {
  if (!existsSync(RATCHET_PATH)) {
    throw new Error(`Missing architecture ratchet: ${relative(process.cwd(), RATCHET_PATH)}`)
  }

  const parsed = JSON.parse(readFileSync(RATCHET_PATH, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || typeof parsed.maxLinesByPath !== 'object') {
    throw new Error('Architecture ratchet must define maxLinesByPath.')
  }

  return parsed.maxLinesByPath
}

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = resolve(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(absolutePath)
    if (!entry.isFile() || !SOURCE_EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf('.')))) return []
    return [absolutePath]
  })
}

function countLines(path) {
  const source = readFileSync(path, 'utf8')
  return source === '' ? 0 : source.split('\n').length - 1
}

const maxLinesByPath = readRatchet()
const violations = []

for (const absolutePath of listSourceFiles(SOURCE_ROOT)) {
  const path = relative(process.cwd(), absolutePath)
  const lineCount = countLines(absolutePath)
  const legacyLimit = maxLinesByPath[path]
  const limit = legacyLimit ?? MAX_NEW_PRODUCTION_FILE_LINES

  if (lineCount > limit) {
    violations.push({ path, lineCount, limit, status: legacyLimit == null ? 'new file' : 'legacy file' })
  }
}

if (violations.length > 0) {
  console.error('Architecture boundary check failed:')
  for (const violation of violations) {
    console.error(`- ${violation.path}: ${violation.lineCount} lines exceeds ${violation.status} limit of ${violation.limit}`)
  }
  process.exitCode = 1
} else {
  console.log(`Architecture boundary check passed: new production files <= ${MAX_NEW_PRODUCTION_FILE_LINES} lines; legacy files did not grow.`)
}
