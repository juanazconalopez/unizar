import type { TrainingGroupAssignment, TrainingGroupColor, TrainingGroupPlayer } from './types'
import { trainingGroupBucket } from './trainingGroupSelectors'

function shuffled<T>(items: T[], random: () => number) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Cada equipo y cada posición difieren como máximo en una jugadora. Los impares
// se reparten según el tamaño global; varias propuestas reducen compañeras repetidas.
export function generateTrainingGroups(players: TrainingGroupPlayer[], previous: TrainingGroupAssignment[] = [], random = Math.random): TrainingGroupAssignment[] {
  const teams = new Map<string | null, TrainingGroupPlayer[]>()
  for (const player of players) {
    const team = teams.get(player.team_id) ?? []
    team.push(player)
    teams.set(player.team_id, team)
  }
  const previousColors = new Map(previous.map((entry) => [entry.player_id, entry.color]))
  let best: TrainingGroupAssignment[] = []
  let bestScore = Infinity
  for (let attempt = 0; attempt < (previous.length ? 80 : 40); attempt += 1) {
    const proposal: TrainingGroupAssignment[] = []
    let totalRed = 0
    let totalWhite = 0
    for (const team of shuffled([...teams.values()], random)) {
      const buckets = new Map<string, TrainingGroupPlayer[]>()
      for (const player of team) {
        const key = trainingGroupBucket(player)
        const bucket = buckets.get(key) ?? []
        bucket.push(player)
        buckets.set(key, bucket)
      }
      const targetRed = Math.floor(team.length / 2) + (team.length % 2 && (totalRed < totalWhite || totalRed === totalWhite && random() < 0.5) ? 1 : 0)
      let extras = targetRed - [...buckets.values()].reduce((sum, bucket) => sum + Math.floor(bucket.length / 2), 0)
      for (const bucket of shuffled([...buckets.values()], random)) {
        const redCount = Math.floor(bucket.length / 2) + (bucket.length % 2 && extras > 0 ? 1 : 0)
        if (redCount > Math.floor(bucket.length / 2)) extras -= 1
        shuffled(bucket, random).forEach((player, index) => proposal.push({ player_id: player.player_id, color: index < redCount ? 'red' : 'white' }))
      }
      totalRed += targetRed
      totalWhite += team.length - targetRed
    }
    // Dentro del equilibrio por equipo, prioriza también el total de posiciones.
    const positions = new Map<string, number>()
    const playerGroups = new Map(players.map((player) => [player.player_id, player.position_group]))
    for (const entry of proposal) {
      const group = playerGroups.get(entry.player_id)!
      positions.set(group, (positions.get(group) ?? 0) + (entry.color === 'red' ? 1 : -1))
    }
    let score = [...positions.values()].reduce((sum, difference) => sum + Math.max(0, Math.abs(difference) - 1), 0) * (players.length ** 2 + 1)
    for (let i = 0; i < proposal.length; i += 1) {
      for (let j = i + 1; j < proposal.length; j += 1) {
        if (proposal[i].color === proposal[j].color && previousColors.has(proposal[i].player_id)
          && previousColors.get(proposal[i].player_id) === previousColors.get(proposal[j].player_id)) score += 1
      }
    }
    if (score < bestScore) { best = proposal; bestScore = score }
    if (score === 0) break
  }
  return best
}

// Altas tardías: conserva el reparto existente y añade únicamente las pendientes.
export function reconcileTrainingGroups(players: TrainingGroupPlayer[], assignments: TrainingGroupAssignment[]): TrainingGroupAssignment[] {
  const next = retainTrainingGroupAssignments(players, assignments)
  const assigned = new Set(next.map((entry) => entry.player_id))
  for (const player of players.filter((item) => !assigned.has(item.player_id))) {
    const cost = (color: TrainingGroupColor) => next.reduce((sum, entry) => {
      const other = players.find((item) => item.player_id === entry.player_id)!
      return sum + (entry.color === color ? 1 : -1) * (trainingGroupBucket(other) === trainingGroupBucket(player) ? 100 : other.team_id === player.team_id ? 10 : 1)
    }, 0)
    next.push({ player_id: player.player_id, color: cost('red') <= cost('white') ? 'red' : 'white' })
  }
  return next
}

// Revisar integrantes conserva sus colores y deja las altas pendientes de decidir.
export function retainTrainingGroupAssignments(players: TrainingGroupPlayer[], assignments: TrainingGroupAssignment[]): TrainingGroupAssignment[] {
  const eligible = new Set(players.map((player) => player.player_id))
  return assignments.filter((entry) => eligible.has(entry.player_id))
}
