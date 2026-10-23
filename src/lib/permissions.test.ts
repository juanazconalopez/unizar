import { describe, expect, test } from 'vitest'
import { makeProfile } from '../test/fixtures'
import { canGenerateTrainingSchedule, canAccessTasks, canBeSeasonTeamCoach, canConfigureClub, canManagePlayerPositions, canManageTrainingExceptions, canManageTrainingGroups, canManageSport, canViewTeamData, effectivePermissions, hasPermission, isPlayer, PERMISSIONS } from './permissions'

describe('role permissions', () => {
  test('training groups preserve read-only access for players and Dirección even if a write key is configured', () => {
    expect(canManageTrainingGroups(makeProfile({ is_owner: true }), [])).toBe(true)
    expect(canManageTrainingGroups(makeProfile({ is_coach: true }))).toBe(true)
    expect(canManageTrainingGroups(makeProfile({ is_coach: true }), [])).toBe(false)
    expect(canManageTrainingGroups(makeProfile({ is_viewer: true }), [PERMISSIONS.trainingGroups.view, PERMISSIONS.trainingGroups.manage])).toBe(false)
    expect(canManageTrainingGroups(makeProfile(), [PERMISSIONS.trainingGroups.view, PERMISSIONS.trainingGroups.manage])).toBe(false)
    expect(canManageTrainingGroups(makeProfile({ is_owner: true, is_active: false }))).toBe(false)
    expect(hasPermission(makeProfile(), PERMISSIONS.trainingGroups.view)).toBe(true)
  })
  test('only enabled owners and coaches may edit positions, respecting the configured permission', () => {
    expect(canManagePlayerPositions(makeProfile({ is_owner: true }), [])).toBe(true)
    expect(canManagePlayerPositions(makeProfile({ is_coach: true }))).toBe(true)
    expect(canManagePlayerPositions(makeProfile({ is_coach: true }), [])).toBe(false)
    expect(canManagePlayerPositions(makeProfile({ is_coach: true, is_active: false }))).toBe(false)
    expect(canManagePlayerPositions(makeProfile({ is_viewer: true }), [PERMISSIONS.team.positions])).toBe(false)
    expect(canManagePlayerPositions(makeProfile(), [PERMISSIONS.team.positions])).toBe(false)
  })
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

  test('lets active owners and coaches be assigned to season teams', () => {
    expect(canBeSeasonTeamCoach(makeProfile({ is_owner: true, is_player: false }))).toBe(true)
    expect(canBeSeasonTeamCoach(makeProfile({ is_coach: true, is_player: false }))).toBe(true)
    expect(canBeSeasonTeamCoach(makeProfile({ is_viewer: true, is_player: false }))).toBe(false)
    expect(canBeSeasonTeamCoach(makeProfile({ is_owner: true, is_active: false }))).toBe(false)
    expect(canBeSeasonTeamCoach(makeProfile({ is_owner: true, is_approved: false }))).toBe(false)
    expect(canBeSeasonTeamCoach(makeProfile({ is_owner: true, is_archived: true }))).toBe(false)
  })

  test('uses loaded role permissions as the effective source without losing owner access', () => {
    const coach = makeProfile({ is_coach: true, is_player: false })
    expect(hasPermission(coach, PERMISSIONS.training.view, [PERMISSIONS.library.view])).toBe(false)
    expect(hasPermission(coach, PERMISSIONS.library.view, [PERMISSIONS.library.view])).toBe(true)

    const owner = makeProfile({ is_owner: true, is_player: false })
    expect(effectivePermissions(owner, []).has(PERMISSIONS.settings.permissions)).toBe(true)
  })

  test('removes every effective permission from disabled profiles', () => {
    const inactiveOwner = makeProfile({ is_owner: true, is_player: false, is_active: false })
    expect(effectivePermissions(inactiveOwner).size).toBe(0)
  })
})

describe('autorizaciones de solo entrenamientos', () => {
  test('solo owner y entrenadores activos con permiso autorizan participaciones', () => {
    expect(canManageTrainingExceptions(makeProfile({ is_owner: true }))).toBe(true)
    expect(canManageTrainingExceptions(makeProfile({ is_coach: true }))).toBe(true)
    expect(canManageTrainingExceptions(makeProfile({ is_coach: true }), [])).toBe(false)
    expect(canManageTrainingExceptions(makeProfile({ is_coach: true, is_active: false }))).toBe(false)
    expect(canManageTrainingExceptions(makeProfile({ is_viewer: true }), [PERMISSIONS.matches.trainingExceptions])).toBe(false)
    expect(canManageTrainingExceptions(makeProfile(), [PERMISSIONS.matches.trainingExceptions])).toBe(false)
  })
})

test('solo owner y entrenadores autorizados generan; las jugadoras responden sin recibir el plan privado', () => {
  expect(canGenerateTrainingSchedule(makeProfile({ is_owner: true }), [])).toBe(true)
  expect(canGenerateTrainingSchedule(makeProfile({ is_coach: true }))).toBe(true)
  expect(canGenerateTrainingSchedule(makeProfile({ is_coach: true }), [])).toBe(false)
  expect(canGenerateTrainingSchedule(makeProfile({ is_owner: true, is_active: false }))).toBe(false)
  expect(canGenerateTrainingSchedule(makeProfile({ is_viewer: true }), [PERMISSIONS.training.generate])).toBe(false)
  expect(canGenerateTrainingSchedule(makeProfile(), [PERMISSIONS.training.generate])).toBe(false)
  expect(hasPermission(makeProfile(), PERMISSIONS.calendar.trainingRespond)).toBe(true)
  expect(hasPermission(makeProfile(), PERMISSIONS.training.view)).toBe(false)
})
