/// <reference path="../pb_data/types.d.ts" />

// Дозаполняем моки для страницы изоляции:
// 1. Куски для групп, у которых их раньше не было вообще (Бока, Крышки днища,
//    Днище, Отделитель жидкости, Верхние крышки, Крышки люков) — раньше это
//    были пустые группы у всех установок, т.к. группы переиспользуемы и куски
//    заводились только под три группы K-Flex в 1785599746_seed_sample_unit.js.
// 2. По одной дополнительной (более старой) версии набора изоляции для
//    КАТ-2402 и КАТ-2405 — проверить дропдаун версии и авто-выбор актуальной.
// Иллюстративные размеры, не реальные производственные (как и остальные моки).

const NEW_GROUP_PIECES = {
  'Бока': [
    ['85х60 (бок)', 85, 60, 13, 2],
    ['85х45 (бок)', 85, 45, 13, 2],
  ],
  'Крышки днища': [
    ['52х38 (крышка днища)', 52, 38, 13, 1],
    ['52х20 (крышка днища)', 52, 20, 6, 2],
  ],
  Днище: [['90х52 (днище)', 90, 52, 13, 1]],
  'Отделитель жидкости': [
    ['22х18 (отделитель)', 22, 18, 6, 1],
    ['30х15 вырез (отделитель)', 30, 15, 6, 1],
  ],
  'Верхние крышки': [
    ['85х60 (верх)', 85, 60, 13, 1],
    ['40х40 (верх)', 40, 40, 6, 2],
  ],
  'Крышки люков': [['25х25 (люк)', 25, 25, 6, 4]],
}

const EXTRA_SET_VERSIONS = [
  {
    unitName: 'КАТ-2402',
    name: 'Первая версия',
    effectiveFrom: '2025-01-15',
    groups: [
      ['Перегородка (K-Flex 13)', 1],
      ['Бока', 1],
    ],
  },
  {
    unitName: 'КАТ-2405',
    name: 'Первая версия',
    effectiveFrom: '2025-06-01',
    groups: [
      ['Перегородка (K-Flex 6)', 1],
      ['Днище', 1],
    ],
  },
]

migrate(
  (app) => {
    const piecesCol = app.findCollectionByNameOrId('insulation_pieces')
    const groupPiecesCol = app.findCollectionByNameOrId('group_pieces')
    const setsCol = app.findCollectionByNameOrId('insulation_sets')
    const setGroupsCol = app.findCollectionByNameOrId('set_groups')

    const make = (collection, fields) => {
      const record = new Record(collection)
      for (const key in fields) record.set(key, fields[key])
      app.save(record)
      return record
    }

    const findGroup = (name) => app.findFirstRecordByFilter('insulation_groups', `name = '${name}'`)
    const findUnit = (name) => app.findFirstRecordByFilter('units', `name = '${name}'`)

    for (const groupName in NEW_GROUP_PIECES) {
      const group = findGroup(groupName)
      if (!group) continue
      NEW_GROUP_PIECES[groupName].forEach(([name, width, height, thicknessMm, qty], index) => {
        const piece = make(piecesCol, {
          name,
          geometry: { kind: 'rect', width, height },
          areaMm2: width * height,
          thicknessMm,
          hasAdhesive: true,
        })
        make(groupPiecesCol, { group: group.id, piece: piece.id, quantity: qty, order: index + 1 })
      })
    }

    for (const spec of EXTRA_SET_VERSIONS) {
      const unit = findUnit(spec.unitName)
      if (!unit) continue
      const set = make(setsCol, {
        unit: unit.id,
        name: spec.name,
        effectiveFrom: spec.effectiveFrom,
      })
      spec.groups.forEach(([groupName, qty], index) => {
        const group = findGroup(groupName)
        if (!group) return
        make(setGroupsCol, { set: set.id, group: group.id, quantity: qty, order: index + 1 })
      })
    }
  },
  (app) => {
    const findOne = (collectionName, filter) => {
      try {
        return app.findFirstRecordByFilter(collectionName, filter)
      } catch (e) {
        return null
      }
    }
    const deleteWhere = (collectionName, filter) => {
      const records = app.findRecordsByFilter(collectionName, filter, '', 0, 0)
      for (const record of records) app.delete(record)
    }

    for (const spec of EXTRA_SET_VERSIONS) {
      const unit = findOne('units', `name = '${spec.unitName}'`)
      if (!unit) continue
      const set = findOne(
        'insulation_sets',
        `unit = '${unit.id}' && name = '${spec.name}' && effectiveFrom = '${spec.effectiveFrom}'`,
      )
      if (set) {
        deleteWhere('set_groups', `set = '${set.id}'`)
        app.delete(set)
      }
    }

    for (const groupName in NEW_GROUP_PIECES) {
      for (const [pieceName] of NEW_GROUP_PIECES[groupName]) {
        const piece = findOne('insulation_pieces', `name = '${pieceName}'`)
        if (!piece) continue
        deleteWhere('group_pieces', `piece = '${piece.id}'`)
        app.delete(piece)
      }
    }
  },
)
