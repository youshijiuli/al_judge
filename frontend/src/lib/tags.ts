const TAGS_KEY = 'faljudge_tags'

export function getTags(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(TAGS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveTags(tags: Record<string, string[]>) {
  localStorage.setItem(TAGS_KEY, JSON.stringify(tags))
}

export function getProblemTags(problemId: string): string[] {
  return getTags()[problemId] || []
}

export function addTag(problemId: string, tag: string) {
  const tags = getTags()
  const existing = tags[problemId] || []
  const normalized = tag.trim()
  if (normalized && !existing.includes(normalized)) {
    tags[problemId] = [...existing, normalized]
    saveTags(tags)
  }
}

export function removeTag(problemId: string, tag: string) {
  const tags = getTags()
  if (tags[problemId]) {
    tags[problemId] = tags[problemId].filter((t) => t !== tag)
    if (tags[problemId].length === 0) {
      delete tags[problemId]
    }
    saveTags(tags)
  }
}

export function getAllUniqueTags(): string[] {
  const tags = getTags()
  const all = new Set<string>()
  Object.values(tags).forEach((arr) => arr.forEach((t) => all.add(t)))
  return Array.from(all).sort()
}
