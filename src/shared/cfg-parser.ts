/**
 * Round-trip safe parser for GregTech .cfg and serverutilities .cfg files.
 * Reads only targeted keys, preserves everything else.
 */

// ---- Structured line-by-line representation ----

export type CfgLine =
  | { type: 'comment' | 'blank' | 'section_close'; raw: string }
  | { type: 'section_open'; name: string; raw: string }
  | { type: 'gt_property'; prefix: string; typePrefix: string; key: string; value: string }
  | { type: 'simple_property'; prefix: string; typePrefix: string; key: string; value: string }

/** Parse every line of a .cfg file into a typed structure, preserving round-trip fidelity. */
export function parseCfgLines(content: string): CfgLine[] {
  return content.split('\n').map((line): CfgLine => {
    const trimmed = line.trim()

    if (!trimmed) return { type: 'blank', raw: line }
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) return { type: 'comment', raw: line }
    if (trimmed === '}') return { type: 'section_close', raw: line }

    // Section open: "Name {" with no '=' on the line
    if (trimmed.endsWith('{') && !trimmed.includes('=')) {
      return { type: 'section_open', name: trimmed.slice(0, -1).trim(), raw: line }
    }

    // GregTech format: [indent]TYPE:"Key Name"=value
    const gt = line.match(/^(\s*)([A-Za-z]):"([^"]+)"=(.*)$/)
    if (gt) {
      return { type: 'gt_property', prefix: gt[1], typePrefix: gt[2].toUpperCase(), key: gt[3], value: gt[4] }
    }

    // Simple format: [indent][TYPE:]key=value
    const simple = line.match(/^(\s*)([A-Z]:)?([^={}\s#/][^={}\s]*)=(.*)$/)
    if (simple) {
      return { type: 'simple_property', prefix: simple[1], typePrefix: simple[2] ?? '', key: simple[3], value: simple[4] }
    }

    return { type: 'comment', raw: line }
  })
}

/** Serialize parsed lines back to a string, reconstructing only property lines. */
export function serializeCfgLines(lines: CfgLine[]): string {
  return lines.map((line): string => {
    if (line.type === 'gt_property') return `${line.prefix}${line.typePrefix}:"${line.key}"=${line.value}`
    if (line.type === 'simple_property') return `${line.prefix}${line.typePrefix}${line.key}=${line.value}`
    return line.raw
  }).join('\n')
}

// ---- GregTech .cfg format: B:"Key Name"=value ----

export function getCfgValue(content: string, key: string): string | undefined {
  const lines = content.split('\n')
  for (const line of lines) {
    const match = line.match(/^\s*[A-Z]:"([^"]+)"=(.+)$/)
    if (match && match[1] === key) {
      return match[2].trim()
    }
  }
  return undefined
}

export function setCfgValue(content: string, key: string, value: string): string {
  const lines = content.split('\n')
  let found = false
  const result = lines.map((line) => {
    const match = line.match(/^(\s*[A-Z]):"([^"]+)"=(.+)$/)
    if (match && match[2] === key) {
      found = true
      return `${match[1]}:"${key}"=${value}`
    }
    return line
  })
  if (!found) {
    throw new Error(`Key "${key}" not found in cfg content`)
  }
  return result.join('\n')
}

// ---- serverutilities.cfg format: key=value inside sections ----

export function getSimpleValue(content: string, key: string): string | undefined {
  const lines = content.split('\n')
  for (const line of lines) {
    const match = line.match(/^\s*([A-Z]:)?([^=\s{]+)=(.+)$/)
    if (match) {
      // Strip type prefix (B:, I:, S:, etc.) if present
      const parsedKey = match[2].trim()
      if (parsedKey === key) {
        return match[3].trim()
      }
    }
  }
  return undefined
}

export function setSimpleValue(content: string, key: string, value: string): string {
  const lines = content.split('\n')
  let found = false
  const result = lines.map((line) => {
    const match = line.match(/^(\s*)([A-Z]:)?([^=\s{]+)(=.+)$/)
    if (match && match[3].trim() === key) {
      found = true
      const prefix = match[1]
      const typePrefix = match[2] ?? ''
      return `${prefix}${typePrefix}${key}=${value}`
    }
    return line
  })
  if (!found) {
    throw new Error(`Key "${key}" not found in config content`)
  }
  return result.join('\n')
}

// ---- startserver-java9.sh memory parsing ----

export function getMemoryFromScript(content: string): { minGb: number; maxGb: number } | null {
  for (const line of content.split('\n')) {
    const match = line.match(/-Xms(\d+)[Gg].*-Xmx(\d+)[Gg]/)
    if (match) {
      return { minGb: parseInt(match[1], 10), maxGb: parseInt(match[2], 10) }
    }
  }
  return null
}

export function setMemoryInScript(content: string, minGb: number, maxGb: number): string {
  return content.replace(
    /-Xms\d+[Gg]\s+-Xmx\d+[Gg]/,
    `-Xms${minGb}G -Xmx${maxGb}G`
  )
}
