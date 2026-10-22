import { todayIso } from '../lib/dates'
import { canManageTrainingGroups } from '../lib/permissions'
import type { ViewName } from '../types'
import type { TrainingData } from './trainingDataService'
import type { SessionQueryCache } from './sessionQueryCache'
import type { TrainingGroupsApi } from '../features/trainingGroups/types'

export const navigationResourceKeys = {
  trainingPlans: () => `training-plans:${todayIso()}`,
  surveys: 'managed-surveys',
  competitionSeasons: 'competition-seasons',
  competitionSeason: (id: string) => `competition-season:${id}`,
  workGroups: (seasonId: string) => `work-groups:${seasonId}`,
  trainingGroups: (seasonId: string, manage: boolean) => `training-group-state:${seasonId}:${manage}:${todayIso()}`,
}

// Solo prepara las listas que se muestran al entrar. Los detalles, imágenes,
// ejercicios reutilizables y resultados individuales siguen bajo demanda.
export async function prepareNavigationResources(view: ViewName, data: TrainingData, cache: SessionQueryCache, groupsApi: TrainingGroupsApi) {
  if (view === 'training') {
    const { fetchTrainingPlans } = await import('./trainingPlansService')
    await cache.load(navigationResourceKeys.trainingPlans(), fetchTrainingPlans)
  } else if (view === 'surveys') {
    const { fetchManageSurveys } = await import('./surveysService')
    await cache.load(navigationResourceKeys.surveys, fetchManageSurveys)
  } else if (view === 'competition') {
    const { fetchCompetitionSeasons, fetchCompetitionSeasonData } = await import('./competitionService')
    const seasons = await cache.load(navigationResourceKeys.competitionSeasons, fetchCompetitionSeasons)
    if (seasons[0]) await cache.load(navigationResourceKeys.competitionSeason(seasons[0].id), () => fetchCompetitionSeasonData(seasons[0].id))
  } else if (view === 'training-groups' || view === 'work-groups' || view === 'video-analysis') {
    const today = todayIso()
    const season = data.seasons.find((item) => item.start_date <= today && item.end_date >= today)
      ?? [...data.seasons].sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
    if (!season) return
    if (view === 'training-groups') {
      const { fetchGroupState } = await import('../features/trainingGroups/trainingGroupState')
      const manage = canManageTrainingGroups(data.profile, data.permissionKeys)
      await cache.load(navigationResourceKeys.trainingGroups(season.id, manage), () => fetchGroupState(groupsApi, season, manage))
    } else {
      const { workGroupsApi } = await import('./workGroupsService')
      await cache.load(navigationResourceKeys.workGroups(season.id), () => workGroupsApi.load(season.id))
    }
  }
}
