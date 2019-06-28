import Vue from "vue";
import { anime365API, myanimelistAPI } from "../../../../helpers";
import { storage } from "kv-storage-polyfill";

const worker = new Worker('/player/worker.js')


/**
 * Загружает данные по аниме
 * @param {{getters: {episodes: anime365.Episode[]}, commit: Function, dispatch: Function}} context 
 * @param {{seriesID: number, episodeInt: number}} payload 
 */
export async function loadSeries({ getters, commit, dispatch }, { seriesID = null, episodeInt = 1 }) {
  /**
   * @type {anime365.api.SeriesSelf}
   */
  const { data } = await anime365API(`/series/${seriesID}`)
  commit('setSeries', data)


  /**
   * episodeInt — Номер серии которую необходимо запустить
   * 
   * Поиск наиболее подходящей серии для запуска
   */

  // Выбираем episodeInt-елемент по порядку
  let startEpisode = getters.episodes[episodeInt - 1]


  // Если серия не подходящая выполнить поиск следующей серии перебором
  if (!startEpisode || parseInt(startEpisode.episodeInt) !== episodeInt) {
    getters.episodes.find(e => parseInt(e.episodeInt) === episodeInt)
  }

  // Если следующей серии не найдено — выполнить поиск предыдущей серии перебором
  if (!startEpisode) {
    startEpisode = getters.episodes.find(e => parseInt(e.episodeInt) === episodeInt - 1)
  }

  // Если предыдущая серия не найдена — выполнить поиск первой серии перебором
  if (!startEpisode && episodeInt != 1) {
    startEpisode = getters.episodes.find(e => parseInt(e.episodeInt) === 1)
  }

  // Если первая серия не найдена — использовать первый элемент из массива серий
  if (!startEpisode) {
    startEpisode = getters.episodes[0]
  }

  if (startEpisode) {
    await dispatch('selectEpisode', startEpisode.id)
  }

  await dispatch('loadEpisodesTitle')
}


/**
 * Устанавливает текущую серию
 * Загружает переводы для текущейсерии
 * Предзагружает данные для следующей серии
 * @param {{getters: {episodes: anime365.Episode[], nextEpisode?: anime365.Episode, previousEpisode?: anime365.Episode}, commit: Function, dispatch: Function}} context 
 * @param {number} episodeID 
 */
export async function selectEpisode({ getters, commit, dispatch }, episodeID) {
  let targetEpisode

  if (getters.nextEpisode && episodeID === getters.nextEpisode.id) {
    targetEpisode = getters.nextEpisode
  } else if (getters.previousEpisode && episodeID === getters.previousEpisode.id) {
    targetEpisode = getters.previousEpisode
  } else {
    targetEpisode = getters.episodes.find(e => e.id === episodeID)
  }

  if (!targetEpisode) {
    return
  }


  commit('selectEpisode', targetEpisode.id)
  {
    const currentURL = new URL(location.href)
    currentURL.searchParams.set('episodeInt', targetEpisode.episodeInt)
    history.replaceState(history.state, '', currentURL.toString())
  }

  await dispatch('loadTranslations', targetEpisode)
  const priorityTranslation = await dispatch('getPriorityTranslation', targetEpisode)

  dispatch('selectTranslation', priorityTranslation)

  // Предварительная загрузка переводов для следующей серии
  Vue.nextTick(() => {
    dispatch('loadTranslations', getters.nextEpisode)
  })
}


/**
 * Загружает доступные переводы для серии
 * @param {{commit: Function}} context
 * @param {anime365.Episode} episode 
 */
export async function loadTranslations({ commit }, episode) {
  if (!episode || (Array.isArray(episode.translations) && episode.translations.length > 0)) {
    return
  }

  /**
   * @type {anime365.api.EpisodeSelf}
   */
  const { data } = await anime365API(`/episodes/${episode.id}`)
  data.translations = data.translations.map(translation => {
    if (!translation.authorsSummary) {
      translation.authorsSummary = 'Неизвестный'
    }

    return translation
  })

  commit('setTranslations', { episodeID: episode.id, translations: data.translations })
}


/**
 * Устанавливает текущий перевод
 * Сохраняет перевод в хранилище приоритетных переводов
 * @param {{commit: Function}} context
 * @param {anime365.Translation} translation 
 */
export async function selectTranslation({ commit }, translation) {
  console.log('selectTranslation', { translation })

  commit('selectTranslation', translation.id)

  /**
   * @type {Map<number, anime365.Translation>}
   */
  let lastSelectedTranslations = await storage.get("lastSelectedTranslations");

  // Если ранее хранилище переводов не создавалось — инициализировать его
  if (!lastSelectedTranslations) {
    lastSelectedTranslations = new Map()
  }

  lastSelectedTranslations.set(translation.seriesId, translation)

  await storage.set("lastSelectedTranslations", lastSelectedTranslations);
}


/**
 * Переключает на предыдущую серию
 * @param {{getters: {previousEpisode: anime365.Episode}, dispatch: Function}} context 
 */
export function selectPreviousEpisode({ getters: { previousEpisode }, dispatch }) {
  if (previousEpisode) {
    dispatch('selectEpisode', previousEpisode.id)
  }
}


/**
 * Переключает на следующую серию
 * @param {{getters: {nextEpisode: anime365.Episode}, dispatch: Function}} context 
 */
export function selectNextEpisode({ getters: { nextEpisode }, dispatch }) {
  if (nextEpisode) {
    dispatch('selectEpisode', nextEpisode.id)
  }
}


/**
 * 
 * @param {{state: vuex.Player, commit: Function}} context 
 */
export async function loadEpisodesTitle({ commit, state }) {
  let currentPage = 1
  let episodeMap = new Map()

  while (true) {
    const promise = myanimelistAPI(`/anime/${state.series.myAnimeListId}/episodes/${currentPage}`);

    if (episodeMap.size) {
      commit('loadEpisodesTitle', episodeMap)
      episodeMap = new Map()
    }

    const resp = await promise
    if (!resp.episodes || !resp.episodes.length) break

    resp.episodes.forEach(e => episodeMap.set(e.episode_id, e))

    if (currentPage >= resp.episodes_last_page) {
      break
    }

    currentPage++
  }

  if (episodeMap.size) {
    commit('loadEpisodesTitle', episodeMap)
  }

}


/**
 * 
 * @param {any} context
 * @param {anime365.Episode} episode 
 */
export function getPriorityTranslation({ }, episode) {

  return new Promise(resolve => {

    worker.onmessage = ({ data: { translation } }) => {
      worker.onmessage = null
      resolve(translation)
    }
    worker.postMessage({ episode })
  })
}