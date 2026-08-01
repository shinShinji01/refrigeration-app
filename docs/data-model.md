# Модель данных

Бэкенд — PocketBase. Все связи через relation-поля, количество вынесено в
join-коллекции (у PocketBase нет полей на связях).

## Принцип

Состав установки и набор изоляции **полностью независимы**:

```
RefrigerationUnit
├── состав узлов ──→ UnitAssembly[] ──→ Assembly ──→ AssemblyPart[] ──→ Part
│                                                                        └── PartPart[] ──→ Part (рекурсивно)
└── наборы изоляции ─→ InsulationSet[] (версии)
                        └── SetGroup[] ──→ InsulationGroup ──→ GroupPiece[] ──→ InsulationPiece
```

Смена версии набора изоляции не трогает состав узлов, и наоборот.

Деталь может сама состоять из деталей (см. `parts` ниже) — это не отдельный уровень
иерархии вроде сборочного узла, а рекурсия внутри одной и той же сущности.

## Коллекции

### units — холодильные установки

| Поле | Тип | Примечание |
|---|---|---|
| `id` | text | авто |
| `name` | text, required | |
| `drawingNumbers` | json (string[]) | номера чертежей, может быть несколько |
| `commissionedAt` | date | если пусто — текущая дата при создании |
| `lastCompletedUnitNo` | number | общий счётчик |
| `lastCompletedUnitNoInsulation` | number | обновляется со страницы изоляции |
| `lastCompletedUnitNoAssembly` | number | обновляется со страницы подсчёта |
| `isArchived` | bool, default false | |

### assemblies — сборочные узлы

| Поле | Тип |
|---|---|
| `id` `name` `drawingNumbers` `commissionedAt` `isArchived` | как выше |
| `introducedAtUnitNo` | number — с какого номера установки пошёл в работу |

### parts — детали

`id` `name` `drawingNumbers` `commissionedAt` `isArchived`

Деталь может рекурсивно состоять из других деталей (пример из практики: деталь
«Фильтрующий элемент» сама раскрывается на «Сетка сварная» + «Лист фильтрующего
материала»). Композиция — через `part_parts`, а не отдельная сущность: с точки
зрения глоссария это всё ещё `Part`, разница только в том, есть ли у него дочерние
детали. Циклы запрещены (деталь не может быть предком самой себя) — проверяется
на уровне API-слоя при сохранении, PocketBase это не валидирует нативно.

### insulation_sets — наборы (версии) изоляции

| Поле | Тип | Примечание |
|---|---|---|
| `unit` | relation → units, required | |
| `name` | text | опционально, для читаемости в дропдауне |
| `effectiveFrom` | date, required | **это и есть «версия»** — дропдаун сортирует по убыванию |
| `isArchived` | bool | |

Актуальная версия = максимальный `effectiveFrom` среди неархивных для данной установки.
Правило выбора по умолчанию задаётся один раз в `entities/insulation-set/lib/pickCurrentSet.ts`.

### insulation_groups — группы теплоизоляции

| Поле | Тип |
|---|---|
| `name` | text, required |
| `commissionedAt` | date |
| `introducedAtUnitNo` | number |
| `isArchived` | bool |

Группа **не привязана** к установке напрямую — она переиспользуема между наборами.
Привязка идёт через `set_groups`.

### insulation_pieces — куски

| Поле | Тип | Примечание |
|---|---|---|
| `name` | text, required | |
| `drawingNumbers` | json (string[]) | |
| `geometry` | json | см. ниже |
| `areaMm2` | number | производное, пишется только через `withComputedArea()` |
| `thicknessMm` | number, required | 6 / 13 / произвольное |
| `hasAdhesive` | bool, default true | |
| `isArchived` | bool | |

### Join-коллекции

`unit_assemblies` — `unit` (rel), `assembly` (rel), `quantity` (number)
`assembly_parts` — `assembly` (rel), `part` (rel), `quantity` (number)
`part_parts` — `parent` (rel → parts), `child` (rel → parts), `quantity` (number), `order` (number)
`set_groups` — `set` (rel), `group` (rel), `quantity` (number), `order` (number)
`group_pieces` — `group` (rel), `piece` (rel), `quantity` (number), `order` (number)

Уникальный индекс на пару (родитель, ребёнок) в каждой — защита от дублей.

### cutting_sessions — прогресс нарезки

| Поле | Тип | Примечание |
|---|---|---|
| `unit` | rel → units | |
| `set` | rel → insulation_sets | какая версия резалась |
| `unitNo` | number | номер установки, которую режем |
| `donePieces` | json | `Record<groupPieceId, true>` — плоский объект, а не массив |
| `status` | select: `in_progress` \| `completed` | |
| `user` | rel → users | |
| `updated` | autodate | |

Одна незакрытая сессия на (unit, set, unitNo). При открытии страницы ищем
`status = in_progress` и подставляем. При «Сохранить» → `completed` + обновляем
`units.lastCompletedUnitNoInsulation`.

Ключ в `donePieces` — id записи `group_pieces`, а не id куска. Один и тот же кусок
может входить в две группы, и они режутся независимо.

Realtime-подписка PocketBase на эту запись решает работу с нескольких устройств.

### stock_sessions — подсчёт наличия

| Поле | Тип |
|---|---|
| `unit` | rel → units |
| `unitNo` | number |
| `partCounts` | json — `Record<partId, number>` |
| `status` | select |
| `user` | rel → users |

### users

Штатная коллекция PocketBase (`type: auth`). Пока авторизации нет — берём первого
пользователя. Когда включим auth, ничего в схеме менять не придётся.

Из коробки уже есть `name` (text) и `avatar` (file, image) — этого достаточно для
блока пользователя в сайдбаре, отдельно заводить не пришлось.

`listRule`/`viewRule` открыты (`""`) — фронту без авторизации нужно читать список
пользователей. `createRule`/`updateRule`/`deleteRule` оставлены как есть из коробки
(`createRule: ""`, `updateRule`/`deleteRule`: `id = @request.auth.id`) — де-факто
заперты, т.к. аутентифицированных пользователей пока нет. Пересмотреть при
внедрении auth.

## Служебные поля

Все коллекции (кроме системных PocketBase) получают `created`/`updated`
(`autodate`) сверх полей, перечисленных выше — это стандартная бухгалтерия
PocketBase, а не часть домена, в таблицах полей не дублируется.

## Геометрия куска

Дискриминированное объединение, координаты в миллиметрах, начало — левый верхний угол
ограничивающего прямоугольника, ось Y вниз.

```ts
type Point = { x: number; y: number };

type Geometry =
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'polygon'; vertices: Point[] };  // замкнутый, последняя точка ≠ первой
```

Прямоугольник хранится отдельным вариантом сознательно: он вводится двумя числами,
это 90% случаев, и не надо гонять четыре вершины ради «ширина × высота».

**Площадь**

- rect: `width * height`
- polygon: формула шнурков, `|Σ(x_i·y_{i+1} − x_{i+1}·y_i)| / 2`

Хранится в `areaMm2`, потому что страница изоляции суммирует площади по сотням кусков
и строит два графика. Пересчитывать шнурки на каждый рендер — бессмысленно.

Единственная точка записи:

```ts
// shared/lib/geometry/withComputedArea.ts
export const withComputedArea = <T extends { geometry: Geometry }>(piece: T) =>
  ({ ...piece, areaMm2: computeArea(piece.geometry) });
```

Все мутации куска проходят через неё. Дрейф исключён по конструкции.

**Редактор**

SVG + pointer events, без библиотек. Сетка с шагом 10мм, привязка вершин к сетке,
режим «только прямые углы» по умолчанию (реальные куски почти всегда прямоугольные
с вырезами) и переключатель на произвольный угол. Рядом — числовое поле длины
текущего сегмента: с планшета точнее набрать число, чем попасть пальцем.

Валидация: минимум 3 вершины, самопересечения запрещены, площадь > 0.

## Что не версионируется

Состав установки по узлам (`unit_assemblies`) — не версионируется, как и просили.
Если понадобится — схема повторяет `insulation_sets` один в один, добавим
`assembly_sets` тем же паттерном без переделки существующего.
