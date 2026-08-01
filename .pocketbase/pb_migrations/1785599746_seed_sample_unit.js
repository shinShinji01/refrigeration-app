/// <reference path="../pb_data/types.d.ts" />

// Тестовые данные для разработки фронта — установка КАТ-2402 из docs/sample-data.md.
// Это иллюстративный набор ("не полный список, но идея понятна"), не реальные
// производственные данные. Состав узла расписан только для двух сборочных узлов
// (Блок приточных вентиляторов, Фильтр укороченный) — ровно как в исходнике.

const UNIT_NAME = 'КАТ-2402'

const ASSEMBLY_QUANTITIES = [
  ['Блок приточных вентиляторов', 1],
  ['Блок конденсаторных вентиляторов', 2],
  ['Фильтр большой', 3],
  ['Фильтр укороченный', 6],
  ['Калорифер водяной', 2],
  ['Испаритель', 2],
  ['Конденсатор', 2],
  ['Заслонка', 2],
  ['Блок ТЭН', 2],
  ['Компрессор', 1],
  ['Отделитель жидкости', 1],
  ['Реле давления', 3],
  ['Реле температуры', 1],
  ['Преобразователь частот', 1],
  ['Блок дросселей', 1],
  ['Клемная колодка', 1],
]

const FAN_ASSEMBLY_NAME = 'Блок приточных вентиляторов'
const FAN_PARTS = [
  ['Вентилятор радиальный', 2],
  ['Диффузор (конфузор)', 1],
  ['Перегородка (первая половина)', 1],
  ['Перегородка (вторая половина)', 1],
  ['Кожух', 1],
  ['Стенка левая', 1],
  ['Стенка правая', 1],
  ['Кольцо-вставка', 6],
  ['Кольцо-врезка', 2],
  ['Кольцо-каплеуловитель', 2],
  ['Шпилька м8', 2],
  ['Втулка аллюминиевая', 2],
]

const FILTER_ASSEMBLY_NAME = 'Фильтр укороченный'
const FILTER_PARTS = [
  ['Корпус', 1],
  ['Стенка', 1],
  ['Полоса прижимная длинная', 2],
  ['Полоса прижимная короткая', 2],
  ['Упор для фильтрующего элемента', 2],
  ['Сетка плетеная', 1],
  ['Фильтрующий элемент', 1],
]

const FILTER_ELEMENT_PART_NAME = 'Фильтрующий элемент'
const FILTER_ELEMENT_CHILDREN = [
  ['Сетка сварная', 1],
  ['Лист фильтрующего материала', 1],
]

const ALL_PART_NAMES = [
  ...FAN_PARTS.map(([name]) => name),
  ...FILTER_PARTS.map(([name]) => name),
  ...FILTER_ELEMENT_CHILDREN.map(([name]) => name),
]

const INSULATION_SET_NAME = 'Основной набор'

const GROUP_SPECS = [
  {
    name: 'Перегородка (K-Flex 13)',
    pieces: [
      ['48х55', 48, 55, 13, 4],
      ['26x48', 26, 48, 13, 4],
      ['28x48', 28, 48, 13, 2],
    ],
  },
  {
    name: 'Перегородка (K-Flex 6)',
    pieces: [['48x7', 48, 7, 6, 2]],
  },
  {
    name: 'Электро отсек (K-Flex 6)',
    pieces: [
      ['33х15', 33, 15, 6, 1],
      ['34х29', 34, 29, 6, 2],
      ['34х30', 34, 30, 6, 1],
      ['17х34', 17, 34, 6, 2],
      ['48х28 (вырез П)', 48, 28, 6, 1],
      ['29х92', 29, 92, 6, 1],
    ],
  },
  { name: 'Бока', pieces: [] },
  { name: 'Крышки днища', pieces: [] },
  { name: 'Днище', pieces: [] },
  { name: 'Отделитель жидкости', pieces: [] },
  { name: 'Верхние крышки', pieces: [] },
  { name: 'Крышки люков', pieces: [] },
]

const ALL_PIECE_NAMES = GROUP_SPECS.flatMap((spec) =>
  spec.pieces.map(([name]) => name),
)

migrate((app) => {
  const col = (name) => app.findCollectionByNameOrId(name)

  const unitsCol = col('units')
  const assembliesCol = col('assemblies')
  const partsCol = col('parts')
  const setsCol = col('insulation_sets')
  const groupsCol = col('insulation_groups')
  const piecesCol = col('insulation_pieces')
  const unitAssembliesCol = col('unit_assemblies')
  const assemblyPartsCol = col('assembly_parts')
  const partPartsCol = col('part_parts')
  const setGroupsCol = col('set_groups')
  const groupPiecesCol = col('group_pieces')

  const make = (collection, fields) => {
    const record = new Record(collection)
    for (const key in fields) record.set(key, fields[key])
    app.save(record)
    return record
  }

  const unit = make(unitsCol, { name: UNIT_NAME })

  const assemblies = {}
  for (const [name, qty] of ASSEMBLY_QUANTITIES) {
    const assembly = make(assembliesCol, { name })
    assemblies[name] = assembly
    make(unitAssembliesCol, { unit: unit.id, assembly: assembly.id, quantity: qty })
  }

  const parts = {}
  const attachParts = (assemblyName, list) => {
    for (const [name, qty] of list) {
      const part = make(partsCol, { name })
      parts[name] = part
      make(assemblyPartsCol, {
        assembly: assemblies[assemblyName].id,
        part: part.id,
        quantity: qty,
      })
    }
  }
  attachParts(FAN_ASSEMBLY_NAME, FAN_PARTS)
  attachParts(FILTER_ASSEMBLY_NAME, FILTER_PARTS)

  FILTER_ELEMENT_CHILDREN.forEach(([name, qty], index) => {
    const child = make(partsCol, { name })
    parts[name] = child
    make(partPartsCol, {
      parent: parts[FILTER_ELEMENT_PART_NAME].id,
      child: child.id,
      quantity: qty,
      order: index + 1,
    })
  })

  const today = new Date().toISOString().slice(0, 10)
  const set = make(setsCol, {
    unit: unit.id,
    name: INSULATION_SET_NAME,
    effectiveFrom: today,
  })

  GROUP_SPECS.forEach((spec, groupIndex) => {
    const group = make(groupsCol, { name: spec.name })
    make(setGroupsCol, {
      set: set.id,
      group: group.id,
      quantity: 1,
      order: groupIndex + 1,
    })
    spec.pieces.forEach(([name, width, height, thicknessMm, qty], pieceIndex) => {
      const piece = make(piecesCol, {
        name,
        geometry: { kind: 'rect', width, height },
        areaMm2: width * height,
        thicknessMm,
        hasAdhesive: true,
      })
      make(groupPiecesCol, {
        group: group.id,
        piece: piece.id,
        quantity: qty,
        order: pieceIndex + 1,
      })
    })
  })
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

  const unit = findOne('units', `name = '${UNIT_NAME}'`)
  if (!unit) return

  const assemblies = ASSEMBLY_QUANTITIES.map(([name]) =>
    findOne('assemblies', `name = '${name}'`),
  ).filter(Boolean)
  const parts = ALL_PART_NAMES.map((name) =>
    findOne('parts', `name = '${name}'`),
  ).filter(Boolean)
  const groups = GROUP_SPECS.map((spec) =>
    findOne('insulation_groups', `name = '${spec.name}'`),
  ).filter(Boolean)
  const pieces = ALL_PIECE_NAMES.map((name) =>
    findOne('insulation_pieces', `name = '${name}'`),
  ).filter(Boolean)
  const set = findOne('insulation_sets', `unit = '${unit.id}' && name = '${INSULATION_SET_NAME}'`)

  for (const piece of pieces) {
    deleteWhere('group_pieces', `piece = '${piece.id}'`)
  }
  for (const group of groups) {
    deleteWhere('set_groups', `group = '${group.id}'`)
  }
  for (const part of parts) {
    deleteWhere('assembly_parts', `part = '${part.id}'`)
    deleteWhere('part_parts', `parent = '${part.id}' || child = '${part.id}'`)
  }
  for (const assembly of assemblies) {
    deleteWhere('unit_assemblies', `assembly = '${assembly.id}'`)
  }

  for (const piece of pieces) app.delete(piece)
  for (const group of groups) app.delete(group)
  for (const part of parts) app.delete(part)
  for (const assembly of assemblies) app.delete(assembly)
  if (set) app.delete(set)
  app.delete(unit)
})
