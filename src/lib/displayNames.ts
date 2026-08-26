export function normalizeDisplayName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function displayNameContains(displayName: string, query: string) {
  return normalizeDisplayName(displayName).includes(normalizeDisplayName(query))
}

export function areDisplayNamesSimilar(first: string, second: string) {
  const normalizedFirst = normalizeDisplayName(first)
  const normalizedSecond = normalizeDisplayName(second)
  if (!normalizedFirst || !normalizedSecond) return false
  if (normalizedFirst === normalizedSecond) return true
  if (Math.min(normalizedFirst.length, normalizedSecond.length) < 5) return false
  return 1 - levenshteinDistance(normalizedFirst, normalizedSecond) / Math.max(normalizedFirst.length, normalizedSecond.length) >= 0.88
}

function levenshteinDistance(first: string, second: string) {
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index)

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    const current = [firstIndex]
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1),
      )
    }
    previous = current
  }

  return previous[second.length]
}
