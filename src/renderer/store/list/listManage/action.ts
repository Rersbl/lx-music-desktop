import { shallowReactive, markRaw, markRawList, toRaw } from '@common/utils/vueTools'
import {
  allMusicList,
  defaultList,
  loveList,
  tempList,
  userLists,
} from './state'
import { overwriteListPosition, overwriteListUpdateInfo, removeListPosition, removeListUpdateInfo } from '@renderer/utils/data'
import { LIST_IDS } from '@common/constants'

export const setUserLists = (lists: LX.List.UserListInfo[]) => {
  userLists.splice(0, userLists.length, ...lists)
  return userLists
}

export const setMusicList = (listId: string, musicList: LX.Music.MusicInfo[]) => {
  const list = shallowReactive(markRawList(musicList))
  allMusicList.set(listId, shallowReactive(musicList))
  return list
}

const overwriteMusicList = (id: string, list: LX.Music.MusicInfo[]) => {
  // console.log(id, list)
  markRawList(list)
  let targetList = allMusicList.get(id)
  if (targetList) {
    targetList.splice(0, targetList.length, ...list)
  } else {
    allMusicList.set(id, shallowReactive(list))
  }
}
const removeMusicList = (id: string) => {
  allMusicList.delete(id)
}

const createUserList = ({
  name,
  id,
  source,
  sourceListId,
  locationUpdateTime,
}: LX.List.UserListInfo, position: number) => {
  if (position < 0 || position >= userLists.length) {
    userLists.push({
      name,
      id,
      source,
      sourceListId,
      locationUpdateTime,
    })
  } else {
    userLists.splice(position, 0, {
      name,
      id,
      source,
      sourceListId,
      locationUpdateTime,
    })
  }
}

const updateList = ({
  name,
  id,
  source,
  sourceListId,
  meta,
  locationUpdateTime,
}: LX.List.UserListInfo & { meta?: { id?: string } }) => {
  let targetList
  switch (id) {
    case defaultList.id:
    case loveList.id:
      break
    case tempList.id:
      tempList.meta = meta ?? {}
      break
    default:
      targetList = userLists.find(l => l.id == id)
      if (!targetList) return
      targetList.name = name
      targetList.source = source
      targetList.sourceListId = sourceListId
      targetList.locationUpdateTime = locationUpdateTime
      break
  }
}

const removeUserList = (id: string) => {
  const index = userLists.findIndex(l => l.id == id)
  if (index < 0) return
  userLists.splice(index, 1)
  // removeMusicList(id)
}

const overwriteUserList = (lists: LX.List.UserListInfo[]) => {
  userLists.splice(0, lists.length, ...lists)
}


// const sendMyListUpdateEvent = (ids: string[]) => {
//   window.app_event.myListUpdate(ids)
// }


export const listDataOverwrite = ({ defaultList, loveList, userList, tempList }: MakeOptional<LX.List.ListDataFull, 'tempList'>): string[] => {
  const updatedListIds: string[] = []
  overwriteUserList(userList.map(({ list, ...listInfo }) => {
    if (allMusicList.has(listInfo.id)) {
      overwriteMusicList(listInfo.id, list)
      updatedListIds.push(listInfo.id)
    }
    return listInfo
  }))
  if (allMusicList.has(LIST_IDS.DEFAULT)) {
    overwriteMusicList(LIST_IDS.DEFAULT, defaultList)
    updatedListIds.push(LIST_IDS.DEFAULT)
  }
  if (allMusicList.has(LIST_IDS.LOVE)) {
    overwriteMusicList(LIST_IDS.LOVE, loveList)
  }
  updatedListIds.push(LIST_IDS.LOVE)

  if (tempList && allMusicList.has(LIST_IDS.TEMP)) {
    overwriteMusicList(LIST_IDS.TEMP, tempList)
    updatedListIds.push(LIST_IDS.TEMP)
  }
  const newIds = [LIST_IDS.DEFAULT, LIST_IDS.LOVE, ...userList.map(l => l.id)]
  if (tempList) newIds.push(LIST_IDS.TEMP)
  overwriteListPosition(newIds)
  overwriteListUpdateInfo(newIds)
  return updatedListIds
}

export const userListCreate = ({ name, id, source, sourceListId, position, locationUpdateTime }: {
  name: string
  id: string
  source?: LX.Source
  sourceListId?: string
  position: number
  locationUpdateTime: number | null
}) => {
  if (userLists.some(item => item.id == id)) return
  const newList: LX.List.UserListInfo = {
    name,
    id,
    source,
    sourceListId,
    locationUpdateTime,
  }
  createUserList(newList, position)
}

export const userListsRemove = (ids: string[]) => {
  const changedIds = []
  for (const id of ids) {
    removeUserList(id)
    if (!allMusicList.has(id)) continue
    removeMusicList(id)
    removeListPosition(id)
    removeListUpdateInfo(id)
    changedIds.push(id)
  }

  return changedIds
}

export const userListsUpdate = (listInfos: LX.List.UserListInfo[]) => {
  for (const info of listInfos) {
    updateList(info)
  }
}

export const userListsUpdatePosition = (position: number, ids: string[]) => {
  const newUserLists = [...userLists]

  // console.log(position, ids)

  const updateLists: LX.List.UserListInfo[] = []

  for (let i = newUserLists.length; i--;) {
    if (ids.includes(newUserLists[i].id)) {
      const list = newUserLists.splice(i, 1)[0]
      list.locationUpdateTime = Date.now()
      updateLists.push(list)
    }
  }
  position = Math.min(newUserLists.length, position)

  newUserLists.splice(position, 0, ...updateLists)
  setUserLists(newUserLists)
}

export const listMusicOverwrite = (listId: string, musicInfos: LX.Music.MusicInfo[]): string[] => {
  const isExist = allMusicList.has(listId)
  overwriteMusicList(listId, musicInfos)
  return isExist || listId == loveList.id ? [listId] : []
}

export const listMusicAdd = (id: string, musicInfos: LX.Music.MusicInfo[], addMusicLocationType: LX.AddMusicLocationType): string[] => {
  const targetList = allMusicList.get(id)
  if (!targetList) return id == loveList.id ? [id] : []

  const listSet = new Set<string>()
  for (const item of targetList) listSet.add(item.id)
  musicInfos = musicInfos.filter(item => {
    if (listSet.has(item.id)) return false
    markRaw(item)
    listSet.add(item.id)
    return true
  })
  switch (addMusicLocationType) {
    case 'top':
      targetList.unshift(...musicInfos)
      break
    case 'bottom':
    default:
      targetList.push(...musicInfos)
      break
  }

  return [id]
}

export const listMusicMove = (fromId: string, toId: string, musicInfos: LX.Music.MusicInfo[], addMusicLocationType: LX.AddMusicLocationType): string[] => {
  return [
    ...listMusicRemove(fromId, musicInfos.map(musicInfo => musicInfo.id)),
    ...listMusicAdd(toId, musicInfos, addMusicLocationType),
  ]
}

export const listMusicRemove = (listId: string, ids: string[]): string[] => {
  let targetList = allMusicList.get(listId)
  if (!targetList) return listId == loveList.id ? [listId] : []

  ids = [...ids]
  for (let i = targetList.length - 1; i > -1; i--) {
    const item = targetList[i]
    const index = ids.indexOf(item.id)
    if (index < 0) continue
    ids.splice(index, 1)
    targetList.splice(i, 1)
  }
  return [listId]
}

export const listMusicUpdateInfo = (musicInfos: LX.List.ListActionMusicUpdate): string[] => {
  const updateListIds = new Set<string>()
  for (const { id, musicInfo } of musicInfos) {
    const targetList = allMusicList.get(id)
    if (!targetList) continue
    const index = targetList.findIndex(l => l.id == musicInfo.id)
    if (index < 0) continue
    const info: LX.Music.MusicInfo = { ...targetList[index] }
    Object.assign(info, {
      name: musicInfo.name,
      singer: musicInfo.singer,
      source: musicInfo.source,
      interval: musicInfo.interval,
      meta: musicInfo.meta,
    })
    targetList.splice(index, 1, markRaw(info))
    updateListIds.add(id)
  }
  return Array.from(updateListIds)
}

export const listMusicUpdatePosition = async(listId: string, position: number, ids: string[]): Promise<string[]> => {
  let targetList = allMusicList.get(listId)
  if (!targetList) return listId == loveList.id ? [listId] : []


  // const infos = Array(ids.length)
  // for (let i = targetList.length; i--;) {
  //   const item = targetList[i]
  //   const index = ids.indexOf(item.id)
  //   if (index < 0) continue
  //   infos.splice(index, 1, targetList.splice(i, 1)[0])
  // }
  // targetList.splice(Math.min(position, targetList.length - 1), 0, ...infos)

  // console.time('ts')

  const list = await window.lx.worker.main.createSortedList(toRaw(targetList), position, ids)
  markRawList(list)
  targetList.splice(0, targetList.length, ...list)
  // console.timeEnd('ts')
  return [listId]
}