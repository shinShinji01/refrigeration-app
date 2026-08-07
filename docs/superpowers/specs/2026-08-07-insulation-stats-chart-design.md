# Фаза 2 изоляции, пункт 3: блок общей статистики и чарты

Реализует раздел «Список изоляции и отслеживание прогресса нарезания»
(`docs/spec.md`, строка 245): «Под списком групп отображаем общую статистику
по использованной теплоизоляции. Отображаем круглый чарт, где наглядно
демонстрируем какая группа использовала наиболее большую площадь. А также
чарт сравнение использования теплоизоляции разной толщины.»

Встаёт между уже смёрженными `widgets/insulation-group-list` (инкремент 2,
`docs/superpowers/specs/2026-08-04-insulation-group-toggle-design.md`) и
`widgets/insulation-global-actions` (инкремент 3,
`docs/superpowers/specs/2026-08-05-insulation-global-buttons-design.md`) —
оба уже занимают отведённые им места на странице, этот блок вставляется
между ними без их изменения.

## Контекст

Сейчас на странице изоляции есть только статистика по толщине **в подвале
каждой отдельной группы** (`summarizeByThickness`, `entities/insulation-piece`,
уже реализовано вместе с инкрементом 2). Нет статистики уровня всего набора:
ни по группам, ни агрегированной по толщине.

## Явно вне рамок этого инкремента

- Кнопка «Сохранить» (финализация сессии, обновление
  `units.lastCompletedUnitNoInsulation`) — отдельный последующий инкремент,
  не пересматривается здесь.
- Сохранение прогресса «человек не успел доделать, отложил на следующий
  день» (`docs/spec.md`, строка 255) — уже решено раньше через серверные
  сессии нарезки (`CuttingSession`, инкремент 1), этот инкремент ничего не
  меняет в этой части.
- Виртуализация чартов/легенды — количество групп в наборе (десятки, не
  сотни) не требует `@tanstack/react-virtual`.

## Смысл данных

Статистика считается **по всему составу набора**, а не только по уже
отмеченным готовыми кускам — согласуется с уже реализованной логикой
подвала группы (`summarizeByThickness` тоже не фильтрует по `isPieceDone`).
«Использовано» здесь означает «сколько материала требуется на этот набор»,
а не «сколько уже реально нарезано». Прогресс нарезки (готово/не готово) —
отдельная ось, эта статистика её не учитывает.

## Данные и API

### Новый эндпоинт — `entities/insulation-piece`

Один комбинированный запрос вместо двух раздельных: агрегация и по группам,
и по толщине нужна для одного и того же визуального блока, значит и
сетевой запрос один.

```ts
interface GroupAreaSummary {
  groupId: InsulationGroupId
  areaM2: number
}

interface InsulationSetStats {
  byGroup: GroupAreaSummary[]
  byThickness: ThicknessSummary[]
}

getInsulationSetStats: builder.query<InsulationSetStats, InsulationGroupId[]>({
  query: (groupIds) => ({
    collection: 'group_pieces',
    method: 'getFullList',
    params: { filter: /* тот же паттерн фильтра group ∈ groupIds, что и в getPiecesForGroups — уточняется в плане реализации */, expand: 'piece' },
  }),
  transformResponse: (records: GroupPieceRecord[]): InsulationSetStats => ({
    byGroup: summarizeByGroup(records),
    byThickness: summarizeByThickness(toPiecesWithQuantity(records)),
  }),
  providesTags: (result, _error, groupIds) =>
    groupIds.map((groupId) => ({ type: 'InsulationPiece' as const, id: `GROUP_${groupId}` })),
}),
```

- В отличие от `getPiecesForGroups`, `transformResponse` **не отбрасывает**
  `group`-поле из сырых `GroupPieceRecord` — оно нужно для агрегации по
  группам, которую здесь и делаем прямо в `transformResponse`, а не
  пост-фактум в компоненте.
- Тегирование — тот же паттерн `GROUP_${groupId}`, что и у
  `getPiecesForGroup(s)`: инвалидируется теми же мутациями состава группы,
  без дополнительных правок в мутациях.
- `useGetInsulationSetStatsQuery(groupIds.length === 0 ? skipToken : groupIds)`
  — `skipToken` при пустом наборе групп, как у `getPiecesForGroups`.

### Новая чистая функция — `entities/insulation-piece/lib/summarizeByGroup.ts`

По аналогии с уже существующей `summarizeByThickness.ts`:

```ts
export const summarizeByGroup = (records: GroupPieceRecord[]): GroupAreaSummary[] => {
  const totalsByGroup = new Map<InsulationGroupId, number>()

  for (const record of records) {
    if (!record.expand?.piece) continue
    const totalAreaMm2 = record.expand.piece.areaMm2 * record.quantity
    const groupId = record.group as InsulationGroupId
    totalsByGroup.set(groupId, (totalsByGroup.get(groupId) ?? 0) + totalAreaMm2)
  }

  return [...totalsByGroup.entries()].map(([groupId, areaMm2]) => ({
    groupId,
    areaM2: areaMm2 / MM2_PER_M2,
  }))
}
```

Работает на сырых `GroupPieceRecord`, а не на `InsulationPieceWithQuantity[]`,
потому что группировка по `group` нужна ровно в той точке, где это поле ещё
не обрезано — до `toPiecesWithQuantity`. `summarizeByThickness`, наоборот,
продолжает принимать `InsulationPieceWithQuantity[]`: в `transformResponse`
вызывается через уже существующий `toPiecesWithQuantity(records)`, без
изменений в самой функции.

Сортировку по убыванию площади (для легенды/«какая группа использовала
больше всего») делает не эта функция, а `useInsulationStats` — там же, где
`groupId` соединяется с названием группы.

## Новые чарт-примитивы — `shared/ui/charts`

Без сторонней библиотеки (`docs/decisions.md`, раздел «Графики»). Оба —
голые SVG-компоненты, headless: не знают о домене, площадях или м² — только
`label`/`value`/`id`. Единицы измерения и форматирование остаются на
стороне `widgets/insulation-stats`.

### `DonutChart.tsx`

```ts
interface DonutSegment {
  id: string
  label: string
  value: number
}

interface DonutChartProps {
  segments: DonutSegment[]
  activeId: string | null
  onSegmentActivate: (id: string | null) => void
}
```

Кольцо из дуг (`<path>`, вычисление через `arc()`-хелпер в
`shared/ui/charts/lib`), цвета сегментов — по порядку из палитры токенов
(`_tokens.scss`), не хардкод. Активный сегмент (`id === activeId`) —
визуально выделен (например, увеличенный радиус/обводка), клик/тап по
сегменту вызывает `onSegmentActivate(id)`, повторный клик по тому же
сегменту — `onSegmentActivate(null)` (снятие подсветки). Каждый сегмент —
`aria-label` вида `"{label}: {value}"` для доступности без чтения SVG.

### `BarChart.tsx`

```ts
interface Bar {
  id: string
  label: string
  value: number
}

interface BarChartProps {
  bars: Bar[]
  activeId: string | null
  onBarActivate: (id: string | null) => void
  valueFormatter?: (value: number) => string
}
```

Ось Y — минимальная шкала (засечки от 0 до `max(value)`, без плотной
сетки — утилитарный стиль, не дашборд). Подпись оси X — `label` (толщина в
мм). Число над столбиком — `valueFormatter(value)` или `value` по
умолчанию, табличными цифрами (`font-variant-numeric: tabular-nums`).
Активный столбик подсвечивается тем же паттерном, что и сегмент доната.
Клик/тап — тот же toggle-паттерн `onBarActivate`.

## Новый виджет — `widgets/insulation-stats`

### `model/useInsulationStats.ts`

Принимает `groups: InsulationGroupWithQuantity[]`.

```ts
export const useInsulationStats = (groups: InsulationGroupWithQuantity[]) => {
  const groupIds = groups.map((group) => group.id)
  const { currentData, isFetching } = useGetInsulationSetStatsQuery(
    groupIds.length === 0 ? skipToken : groupIds,
  )

  const byGroup = (currentData?.byGroup ?? [])
    .map((entry) => ({
      id: entry.groupId,
      label: groups.find((group) => group.id === entry.groupId)?.name ?? '—',
      areaM2: entry.areaM2,
    }))
    .sort((a, b) => b.areaM2 - a.areaM2)

  const byThickness = currentData?.byThickness ?? []
  const totalAreaM2 = byGroup.reduce((sum, entry) => sum + entry.areaM2, 0)

  return { byGroup, byThickness, totalAreaM2, isLoading: isFetching }
}
```

- `currentData`/`isFetching` (не `data`/`isLoading`) — тот же паттерн защиты
  от гонки версий набора, что уже в `InsulationPage` и
  `useInsulationGlobalActions`: на смене версии `data` какое-то время
  отдаёт статистику СТАРОЙ версии при уже новых `groupIds`.
- Джойн имён групп — здесь, а не в `transformResponse` эндпоинта: имена
  групп уже есть на странице (`groups`), дублировать их в ответе API не
  нужно.
- Сортировка по убыванию `areaM2` — порядок сегментов доната и строк
  легенды: «какая группа использовала больше всего» видно по порядку
  сверху вниз, без дополнительного чтения чисел.

### `ui/InsulationStats.tsx`

```ts
interface InsulationStatsProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
}
```

- Внутри — `useInsulationStats(groups)` и локальный
  `const [activeId, setActiveId] = useState<string | null>(null)`.
- Если `isLoading` (свой или пришедший из пропа, аналогично
  `InsulationGlobalActions`) — ничего не рендерит (спиннер уровня страницы
  уже есть на списке групп, дублировать не нужно).
- Если `!isLoading && totalAreaM2 === 0` — `EmptyState` (переиспользуем
  существующий `shared/ui` компонент, как и в остальном приложении).
- Иначе — вертикально друг под другом (мобильный сценарий: обе секции на
  всю ширину, `respond-to(tablet)` не нужен — на десктопе просто длиннее):
  1. `DonutChart` (данные — `byGroup`), `activeId`, `onSegmentActivate={setActiveId}`.
  2. Легенда — `<ul>` под донатом: цветной маркер (тот же цвет и порядок,
     что использует `DonutChart` для сегментов), название группы,
     `{areaM2.toFixed(3)} м²`, `{(areaM2 / totalAreaM2 * 100).toFixed(0)}%`.
     Клик по строке легенды тоже вызывает `setActiveId` (двусторонняя
     синхронизация легенда↔сегмент), `aria-current` на активной строке.
  3. `BarChart` (данные — `byThickness`, `label = `${thicknessMm} мм``,
     `value = areaM2`), свой независимый `activeId` (второй `useState`,
     подсветка столбика не связана с легендой доната).
- `key={selectedSetId}` при рендере в `InsulationPage` — сбрасывает оба
  `activeId` при смене версии набора (иначе может остаться подсвеченным
  сегмент/столбик, которого в новых данных уже нет).

### `InsulationPage`

```tsx
<InsulationGroupList key={selectedSetId} ... />
<InsulationStats key={selectedSetId} groups={groups} isLoading={isFetching} />
<InsulationGlobalActions groups={groups} ... />
```

Тот же `isFetching` от `useGetGroupsForSetQuery`, что уже прокидывается в
`InsulationGroupList` — сигнализирует загрузку списка групп, пока свой
собственный `useInsulationStats` внутри виджета ещё не начал запрос.

## Обработка ошибок и краевые случаи

- Пустой набор (`totalAreaM2 === 0`, включая случай групп без кусков) —
  `EmptyState` вместо чартов.
- Ошибка запроса (`isError` от `useGetInsulationSetStatsQuery`) —
  переиспользуется существующий в приложении паттерн отображения ошибки
  RTK Query-запроса (без нового UI ради этого инцидента).
- Один элемент (набор из одной группы, или все куски одной толщины) —
  донат рисует один сплошной сегмент, бар — один столбик; чарт-примитивы
  не требуют минимум двух элементов.
- Смена версии набора во время загрузки статистики — покрыто
  `currentData`/`isFetching` и `key={selectedSetId}` (см. выше).

## Тестирование

- `summarizeByGroup.test.ts` — юнит на агрегацию: несколько групп,
  несколько кусков с разным `quantity`, куски без `expand.piece`
  игнорируются (по аналогии с уже существующим
  `summarizeByThickness.test.ts`).
- `useInsulationStats` — тест хука на MSW: джойн имён групп, сортировка по
  убыванию площади, `skipToken` при `groups.length === 0`, `totalAreaM2`
  считается верно.
- `DonutChart`/`BarChart` (RTL) — число сегментов/столбиков соответствует
  данным, `aria-label`/подписи, `onSegmentActivate`/`onBarActivate`
  вызывается по клику с правильным `id`, повторный клик по активному
  элементу вызывает с `null`.
- `InsulationStats` — интеграционный тест: `EmptyState` при
  `totalAreaM2 === 0`, синхронная подсветка легенда↔сегмент доната,
  независимость `activeId` бар-чарта от доната.
- `pnpm check` — обязательно перед коммитом.
