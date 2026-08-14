import { describe, expect, test } from 'vitest'
import { makeProfile } from '../test/fixtures'
import { canAccessTasks, canConfigureClub, canManageSport, canViewTeamData, isPlayer } from './permissions'

describe('role permissions', () => {
  test('gives the owner every permission', () => {
    const owner = makeProfile({ is_owner: true, is_player: false })
    expect(canConfigureClub(owner)).toBe(true)
    expect(canManageSport(owner)).toBe(true)
    expect(canViewTeamData(owner)).toBe(true)
    expect(isPlayer(owner)).toBe(false)
  })

  test('lets coaches manage sport without configuring the club', () => {
    const coach = makeProfile({ is_coach: true, is_player: false })
    expect(canConfigureClub(coach)).toBe(false)
    expect(canManageSport(coach)).toBe(true)
    expect(canViewTeamData(coach)).toBe(true)
    expect(isPlayer(coach)).toBe(false)
  })

  test('keeps Dirección read-only and outside player calculations', () => {
    const viewer = makeProfile({ is_viewer: true, is_player: false })
    expect(canConfigureClub(viewer)).toBe(false)
    expect(canManageSport(viewer)).toBe(false)
    expect(canViewTeamData(viewer)).toBe(true)
    expect(isPlayer(viewer)).toBe(false)
    expect(canAccessTasks(viewer)).toBe(false)
  })

  test('combines player permissions with coach or Dirección permissions', () => {
    const playerCoach = makeProfile({ is_coach: true })
    const playerViewer = makeProfile({ is_viewer: true })

    expect(isPlayer(playerCoach)).toBe(true)
    expect(canManageSport(playerCoach)).toBe(true)
    expect(isPlayer(playerViewer)).toBe(true)
    expect(canViewTeamData(playerViewer)).toBe(true)
    expect(canAccessTasks(playerViewer)).toBe(true)
  })
})
