/// <reference path="../pb_data/types.d.ts" />

// Начальная схема БД. См. docs/data-model.md — единственный источник правды
// по полям; при расхождении схему правит этот файл, а описание — data-model.md.
//
// Публичные CRUD-правила ("") на доменных коллекциях — временное решение до
// внедрения авторизации, см. docs/decisions.md.

migrate((app) => {
  const created = (onUpdate) => ({
    name: onUpdate ? 'updated' : 'created',
    type: 'autodate',
    onCreate: true,
    onUpdate: !!onUpdate,
  })

  // --- users (auth, встроенная коллекция PocketBase) ---------------------
  // Не создаём — она уже существует после инициализации. Только открываем
  // публичное чтение (без авторизации фронту нужно брать "первого пользователя"),
  // создание/правку оставляем запертыми (только суперюзер), см. docs/decisions.md.
  const users = app.findCollectionByNameOrId('users')
  users.listRule = ''
  users.viewRule = ''
  app.save(users)

  // --- units ------------------------------------------------------------
  const units = new Collection({
    name: 'units',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'drawingNumbers', type: 'json' },
      { name: 'commissionedAt', type: 'date' },
      { name: 'lastCompletedUnitNo', type: 'number' },
      { name: 'lastCompletedUnitNoInsulation', type: 'number' },
      { name: 'lastCompletedUnitNoAssembly', type: 'number' },
      { name: 'isArchived', type: 'bool' },
      created(false),
      created(true),
    ],
  })
  app.save(units)

  // --- assemblies ---------------------------------------------------------
  const assemblies = new Collection({
    name: 'assemblies',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'drawingNumbers', type: 'json' },
      { name: 'commissionedAt', type: 'date' },
      { name: 'introducedAtUnitNo', type: 'number' },
      { name: 'isArchived', type: 'bool' },
      created(false),
      created(true),
    ],
  })
  app.save(assemblies)

  // --- parts ----------------------------------------------------------
  const parts = new Collection({
    name: 'parts',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'drawingNumbers', type: 'json' },
      { name: 'commissionedAt', type: 'date' },
      { name: 'isArchived', type: 'bool' },
      created(false),
      created(true),
    ],
  })
  app.save(parts)

  // --- insulation_sets ------------------------------------------------
  const insulationSets = new Collection({
    name: 'insulation_sets',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'unit',
        type: 'relation',
        required: true,
        collectionId: units.id,
        maxSelect: 1,
      },
      { name: 'name', type: 'text' },
      { name: 'effectiveFrom', type: 'date', required: true },
      { name: 'isArchived', type: 'bool' },
      created(false),
      created(true),
    ],
  })
  app.save(insulationSets)

  // --- insulation_groups ------------------------------------------------
  const insulationGroups = new Collection({
    name: 'insulation_groups',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'commissionedAt', type: 'date' },
      { name: 'introducedAtUnitNo', type: 'number' },
      { name: 'isArchived', type: 'bool' },
      created(false),
      created(true),
    ],
  })
  app.save(insulationGroups)

  // --- insulation_pieces ------------------------------------------------
  const insulationPieces = new Collection({
    name: 'insulation_pieces',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'drawingNumbers', type: 'json' },
      { name: 'geometry', type: 'json' },
      { name: 'areaMm2', type: 'number' },
      { name: 'thicknessMm', type: 'number', required: true },
      { name: 'hasAdhesive', type: 'bool' },
      { name: 'isArchived', type: 'bool' },
      created(false),
      created(true),
    ],
  })
  app.save(insulationPieces)

  // --- unit_assemblies (join) -------------------------------------------
  const unitAssemblies = new Collection({
    name: 'unit_assemblies',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'unit',
        type: 'relation',
        required: true,
        collectionId: units.id,
        maxSelect: 1,
      },
      {
        name: 'assembly',
        type: 'relation',
        required: true,
        collectionId: assemblies.id,
        maxSelect: 1,
      },
      { name: 'quantity', type: 'number', required: true, onlyInt: true },
      created(false),
      created(true),
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_unique_unit_assemblies ON unit_assemblies (unit, assembly)',
    ],
  })
  app.save(unitAssemblies)

  // --- assembly_parts (join) ---------------------------------------------
  const assemblyParts = new Collection({
    name: 'assembly_parts',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'assembly',
        type: 'relation',
        required: true,
        collectionId: assemblies.id,
        maxSelect: 1,
      },
      {
        name: 'part',
        type: 'relation',
        required: true,
        collectionId: parts.id,
        maxSelect: 1,
      },
      { name: 'quantity', type: 'number', required: true, onlyInt: true },
      created(false),
      created(true),
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_unique_assembly_parts ON assembly_parts (assembly, part)',
    ],
  })
  app.save(assemblyParts)

  // --- part_parts (join, self-relation) -----------------------------------
  const partParts = new Collection({
    name: 'part_parts',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'parent',
        type: 'relation',
        required: true,
        collectionId: parts.id,
        maxSelect: 1,
      },
      {
        name: 'child',
        type: 'relation',
        required: true,
        collectionId: parts.id,
        maxSelect: 1,
      },
      { name: 'quantity', type: 'number', required: true, onlyInt: true },
      { name: 'order', type: 'number', onlyInt: true },
      created(false),
      created(true),
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_unique_part_parts ON part_parts (parent, child)',
    ],
  })
  app.save(partParts)

  // --- set_groups (join) --------------------------------------------------
  const setGroups = new Collection({
    name: 'set_groups',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'set',
        type: 'relation',
        required: true,
        collectionId: insulationSets.id,
        maxSelect: 1,
      },
      {
        name: 'group',
        type: 'relation',
        required: true,
        collectionId: insulationGroups.id,
        maxSelect: 1,
      },
      { name: 'quantity', type: 'number', required: true, onlyInt: true },
      { name: 'order', type: 'number', onlyInt: true },
      created(false),
      created(true),
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_unique_set_groups ON set_groups (`set`, `group`)',
    ],
  })
  app.save(setGroups)

  // --- group_pieces (join) -------------------------------------------------
  const groupPieces = new Collection({
    name: 'group_pieces',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'group',
        type: 'relation',
        required: true,
        collectionId: insulationGroups.id,
        maxSelect: 1,
      },
      {
        name: 'piece',
        type: 'relation',
        required: true,
        collectionId: insulationPieces.id,
        maxSelect: 1,
      },
      { name: 'quantity', type: 'number', required: true, onlyInt: true },
      { name: 'order', type: 'number', onlyInt: true },
      created(false),
      created(true),
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_unique_group_pieces ON group_pieces (`group`, piece)',
    ],
  })
  app.save(groupPieces)

  // --- cutting_sessions -----------------------------------------------
  const cuttingSessions = new Collection({
    name: 'cutting_sessions',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'unit',
        type: 'relation',
        required: true,
        collectionId: units.id,
        maxSelect: 1,
      },
      {
        name: 'set',
        type: 'relation',
        required: true,
        collectionId: insulationSets.id,
        maxSelect: 1,
      },
      { name: 'unitNo', type: 'number' },
      { name: 'donePieces', type: 'json' },
      {
        name: 'status',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['in_progress', 'completed'],
      },
      {
        name: 'user',
        type: 'relation',
        required: true,
        collectionId: users.id,
        maxSelect: 1,
      },
      created(false),
      created(true),
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_unique_open_cutting_session ON cutting_sessions (unit, `set`, unitNo) WHERE status = 'in_progress'",
    ],
  })
  app.save(cuttingSessions)

  // --- stock_sessions -------------------------------------------------
  const stockSessions = new Collection({
    name: 'stock_sessions',
    type: 'base',
    listRule: '',
    viewRule: '',
    createRule: '',
    updateRule: '',
    deleteRule: '',
    fields: [
      {
        name: 'unit',
        type: 'relation',
        required: true,
        collectionId: units.id,
        maxSelect: 1,
      },
      { name: 'unitNo', type: 'number' },
      { name: 'partCounts', type: 'json' },
      {
        name: 'status',
        type: 'select',
        required: true,
        maxSelect: 1,
        values: ['in_progress', 'completed'],
      },
      {
        name: 'user',
        type: 'relation',
        required: true,
        collectionId: users.id,
        maxSelect: 1,
      },
      created(false),
      created(true),
    ],
  })
  app.save(stockSessions)
}, (app) => {
  const names = [
    'stock_sessions',
    'cutting_sessions',
    'group_pieces',
    'set_groups',
    'part_parts',
    'assembly_parts',
    'unit_assemblies',
    'insulation_pieces',
    'insulation_groups',
    'insulation_sets',
    'parts',
    'assemblies',
    'units',
  ]
  for (const name of names) {
    const collection = app.findCollectionByNameOrId(name)
    app.delete(collection)
  }

  // users — встроенная коллекция, не удаляем, только откатываем правила
  const users = app.findCollectionByNameOrId('users')
  users.listRule = null
  users.viewRule = null
  app.save(users)
})
