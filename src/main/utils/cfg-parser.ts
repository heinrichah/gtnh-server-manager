/**
 * Round-trip safe parser for GregTech .cfg and serverutilities .cfg files.
 * Reads only targeted keys, preserves everything else.
 */

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
