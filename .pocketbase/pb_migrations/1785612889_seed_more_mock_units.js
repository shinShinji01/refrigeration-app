/// <reference path="../pb_data/types.d.ts" />

// Ещё 3 мок-установки для проверки фронта — поиска, фильтра архива и (позже)
// каскадных дропдаунов. Узлы и группы изоляции НЕ дублируются: переиспользуют
// каталог, созданный в 1785599746_seed_sample_unit.js, только с другим набором
// и количеством (см. docs/sample-data.md — "остальные установки примерно схожи").

const UNITS = [
  {
    name: 'КАТ-2405',
    isArchived: false,
    assemblies: [
      ['Блок приточных вентиляторов', 1],
      ['Блок конденсаторных вентиляторов', 2],
      ['Фильтр большой', 2],
      ['Фильтр укороченный', 4],
      ['Калорифер водяной', 1],
      ['Испаритель', 2],
      ['Конденсатор', 2],
      ['Заслонка', 2],
      ['Компрессор', 1],
      ['Отделитель жидкости', 1],
      ['Реле давления', 2],
      ['Реле температуры', 1],
      ['Преобразователь частот', 1],
      ['Блок дросселей', 1],
      ['Клемная колодка', 1],
      // без "Блок ТЭН" — неотапливаемый вариант
    ],
    groups: [
      ['Перегородка (K-Flex 13)', 1],
      ['Перегородка (K-Flex 6)', 1],
      ['Электро отсек (K-Flex 6)', 1],
      ['Бока', 1],
      ['Днище', 1],
      ['Крышки люков', 1],
    ],
  },
  {
    name: 'КАТ-2410',
    isArchived: false,
    assemblies: [
      ['Блок приточных вентиляторов', 2],
      ['Блок конденсаторных вентиляторов', 3],
      ['Фильтр большой', 4],
      ['Фильтр укороченный', 8],
      ['Калорифер водяной', 3],
      ['Испаритель', 3],
      ['Конденсатор', 3],
      ['Заслонка', 3],
      ['Блок ТЭН', 3],
      ['Компрессор', 2],
      ['Отделитель жидкости', 1],
      ['Реле давления', 4],
      ['Реле температуры', 2],
      ['Преобразователь частот', 1],
      ['Блок дросселей', 2],
      ['Клемная колодка', 1],
    ],
    groups: [
      ['Перегородка (K-Flex 13)', 2],
      ['Перегородка (K-Flex 6)', 1],
      ['Электро отсек (K-Flex 6)', 1],
      ['Бока', 1],
      ['Крышки днища', 1],
      ['Днище', 1],
      ['Отделитель жидкости', 1],
      ['Верхние крышки', 1],
      ['Крышки люков', 1],
    ],
  },
  {
    // Архивная — на ней проверяется чекбокс "Показать архивные".
    name: 'КАТ-2312',
    isArchived: true,
    assemblies: [
      ['Блок приточных вентиляторов', 1],
      ['Фильтр укороченный', 4],
      ['Испаритель', 1],
      ['Конденсатор', 1],
      ['Компрессор', 1],
      ['Клемная колодка', 1],
    ],
    groups: [
      ['Перегородка (K-Flex 6)', 1],
      ['Бока', 1],
      ['Днище', 1],
    ],
  },
]

const INSULATION_SET_NAME = 'Основной набор'
const UNIT_NAMES = UNITS.map((u) => u.name)

migrate((app) => {
  const unitsCol = app.findCollectionByNameOrId('units')
  const unitAssembliesCol = app.findCollectionByNameOrId('unit_assemblies')
  const setsCol = app.findCollectionByNameOrId('insulation_sets')
  const setGroupsCol = app.findCollectionByNameOrId('set_groups')

  const make = (collection, fields) => {
    const record = new Record(collection)
    for (const key in fields) record.set(key, fields[key])
    app.save(record)
    return record
  }

  const findAssembly = (name) => app.findFirstRecordByFilter('assemblies', `name = '${name}'`)
  const findGroup = (name) => app.findFirstRecordByFilter('insulation_groups', `name = '${name}'`)

  const today = new Date().toISOString().slice(0, 10)

  for (const spec of UNITS) {
    const unit = make(unitsCol, { name: spec.name, isArchived: spec.isArchived })

    for (const [assemblyName, qty] of spec.assemblies) {
      const assembly = findAssembly(assemblyName)
      make(unitAssembliesCol, { unit: unit.id, assembly: assembly.id, quantity: qty })
    }

    const set = make(setsCol, {
      unit: unit.id,
      name: INSULATION_SET_NAME,
      effectiveFrom: today,
    })

    spec.groups.forEach(([groupName, qty], index) => {
      const group = findGroup(groupName)
      make(setGroupsCol, { set: set.id, group: group.id, quantity: qty, order: index + 1 })
    })
  }
}, (app) => {
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

  for (const name of UNIT_NAMES) {
    const unit = findOne('units', `name = '${name}'`)
    if (!unit) continue

    const set = findOne('insulation_sets', `unit = '${unit.id}' && name = '${INSULATION_SET_NAME}'`)
    if (set) {
      deleteWhere('set_groups', `set = '${set.id}'`)
      app.delete(set)
    }

    deleteWhere('unit_assemblies', `unit = '${unit.id}'`)
    app.delete(unit)
  }
})
