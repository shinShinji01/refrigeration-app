# Insulation list — view controls and stats layout — Design

## Контекст

Страница `/insulation` («Список изоляции и отслеживание прогресса нарезания») уже
реализована: аккордеон групп (`InsulationGroupList` → `InsulationGroupItem` →
`InsulationPieceCard`), глобальные кнопки готовности (`InsulationGlobalActions`),
кнопка «Сохранить» (`InsulationSaveSession`), блок общей статистики
(`InsulationStats` — donut-чарт по группам + bar-чарт по толщине).

Этот дизайн — шесть доработок поверх уже готовой страницы, инициированных
пользователем:

1. Кнопка свернуть/развернуть все группы.
2. Флажок «Подробная информация» на карточке куска — в свёрнутом виде остаются
   только название, размер, толщина.
3. Сквозной (вне групп) вид кусков, сгруппированных по толщине, для удобства
   физической нарезки — с ненавязчивой меткой исходной группы на карточке.
4. Легенда donut-чарта — справа от чарта на десктопе.
5. Статистика по толщине — текстом, без bar-чарта.
6. Блок статистики — под кнопками отметки готовности и сохранения (в конце
   страницы), а не сразу под списком групп.

Полная история вопросов/ответов, приведших к этим решениям, — брейншторм-сессия
2026-08-10 (см. git log сообщения коммитов этой ветки).

## Архитектура

`widgets/insulation-group-list` расширяется — становится «списком кусков
набора в выбранной группировке», а не только аккордеоном по группам:

```
widgets/insulation-group-list/
  ui/
    InsulationGroupList.tsx      — Tabs.Root, переключает вид + рендерит тулбар
    InsulationListToolbar.tsx    — новый: тумблер свернуть/развернуть + Checkbox "Подробно" + TabsList
    InsulationGroupItem.tsx      — существующий, без структурных изменений (новый проп detailed на карточках)
    InsulationThicknessList.tsx  — новый: плоский список секций по толщине
  model/
    useInsulationGroupList.ts    — новый: openGroupIds, activeView, detailed (объединяет локальный и persisted стейт)
  index.ts
```

`entities/insulation-piece`:
- `InsulationPieceWithQuantity` получает поле `groupId: InsulationGroupId`
  (заполняется из уже приходящего в ответе `link.group` — без нового запроса
  к PocketBase, чисто расширение производного TS-типа join'а, схема БД не
  меняется).
- Новая чистая функция `groupByThickness(pieces): ThicknessGroup[]` в
  `entities/insulation-piece/lib`, где `ThicknessGroup = { thicknessMm: number;
  pieces: InsulationPieceWithQuantity[] }`, отсортировано по возрастанию
  `thicknessMm`. Аналог уже существующей `summarizeByThickness`, но возвращает
  сами куски, а не агрегированную площадь.

`entities/insulation-piece/ui/InsulationPieceCard`:
- Новый проп `detailed: boolean` (обязательный) — управляет видимостью
  подзаголовка (номера чертежей), строки «Площадь», отметки «Клеевой слой».
  При `detailed=false` остаются: название, «Размер», «Толщина».
- Новый опциональный проп `groupLabel?: string` — приглушённая подпись группы
  на карточке, рендерится независимо от `detailed` (нужна именно в свёрнутом
  виде тоже — это навигационная метка таба «По толщине», не деталь).

`shared/lib/hooks`:
- Новый `useLocalStorageState<T>(key: string, initial: T): [T, (value: T) =>
  void]` — синхронизация `useState` с `localStorage` (JSON.stringify/parse,
  try/catch на битые данные). Без домена, соседствует с `useDebounce`/
  `useMediaQuery`.

`widgets/insulation-stats`:
- `InsulationStats.module.scss` — `.root` получает
  `@include respond-to(tablet) { display: grid; grid-template-columns: auto 1fr; align-items: start; }`
  так, что donut-чарт занимает первую колонку, `.legend` — вторую. На мобиле
  раскладка не меняется (легенда под чартом, как сейчас).
- `BarChart` убирается из `InsulationStats.tsx`. Вместо него — `<ul>` в
  формате `«{thicknessMm} мм — {areaM2.toFixed(3)} м²»`, тот же формат, что
  уже в подвале `InsulationGroupItem`. `shared/ui/charts/BarChart` из
  кодовой базы не удаляется (компонент общего назначения) — просто
  перестаёт использоваться на этой странице.

`pages/insulation/ui/InsulationPage.tsx`:
- Порядок виджетов меняется на: `InsulationGroupList` → `InsulationGlobalActions`
  → `InsulationSaveSession` → `InsulationStats`.

**Новая зависимость:** `@radix-ui/react-tabs` — для табов «По группам / По
толщине». Та же семья компонентов, что уже используемый
`@radix-ui/react-accordion`/`@radix-ui/react-checkbox`/`@radix-ui/react-dialog`.
Добавить в список утверждённых зависимостей `docs/decisions.md`.

## Компоненты по пунктам запроса

### 1. Тумблер «Развернуть/Свернуть все»

`Accordion.Root` в табе «По группам» становится управляемым:
`value={openGroupIds}` / `onValueChange={setOpenGroupIds}` (Radix
`type="multiple"` принимает `string[]`). `openGroupIds` — часть
`useInsulationGroupList()`, обычный локальный React-стейт (не localStorage),
инициализируется полным списком `linkId` групп при каждом монтировании/смене
набора (`key={selectedSetId}` уже пересоздаёт компонент) — поведение
по умолчанию (все группы развёрнуты) не меняется.

Одна кнопка-тумблер в `InsulationListToolbar`:
- `openGroupIds.length === groups.length` → подпись «Свернуть все», клик →
  `setOpenGroupIds([])`
- иначе (в т.ч. когда пользователь вручную свернул часть групп) → подпись
  «Развернуть все», клик → `setOpenGroupIds(groups.map(g => g.linkId))`

Кнопка видна только когда `activeView === 'byGroup'` — на «По толщине»
сворачивать нечего (плоский список, см. пункт 3). Индивидуальные шевроны в
`InsulationGroupItem` продолжают работать как раньше — Radix сам
синхронизирует `value` при точечном клике.

### 2. Флажок «Подробная информация»

`Checkbox` из `shared/ui` в `InsulationListToolbar`, подпись «Подробная
информация». Стейт — `useLocalStorageState<boolean>('insulation.detailedCards',
true)` — по умолчанию включено (совпадает с сегодняшним поведением карточки
без флажка), дальше сохраняется в `localStorage` и переживает перезагрузку
страницы/новую сессию.

Значение пробрасывается в каждую `InsulationPieceCard` как `detailed` —
одинаково на обоих табах (это настройка отображения карточки, не
группировки).

### 3. Таб «По толщине»

`Tabs.Root` (Radix) в `InsulationGroupList`, значение —
`activeView: 'byGroup' | 'byThickness'`, персистится через
`useLocalStorageState('insulation.view', 'byGroup')`. `TabsList` с двумя
`TabsTrigger` — «По группам» / «По толщине» — рендерится в
`InsulationListToolbar`.

Данные: `useGetPiecesForGroupsQuery(groups.map(g => g.id))` — существующий
bulk-эндпоинт (`entities/insulation-piece`), уже используемый
`widgets/insulation-global-actions`; RTK Query дедуплицирует запрос по
эндпоинту+аргументам, лишнего похода в PocketBase нет. Результат (теперь с
`groupId` на каждом куске) прогоняется через `groupByThickness`.

`InsulationThicknessList` — простой список секций, **не аккордеон**: заголовок
`«{thicknessMm} мм»`, под ним сетка карточек этой толщины (та же вёрстка
сетки, что в `InsulationGroupItem.module.scss` → `.grid`). Без сворачивания
и без кнопок массовой отметки на уровне секции — эта функциональность
осталась только у групп (пункт 1).

Имя группы куска передаётся как `groupLabel` в `InsulationPieceCard` —
рендерится мелкой приглушённой подписью-тегом (`$color-text-muted`, мелкий
шрифт, без цветного акцента) — навигационная метка, не деталь, поэтому
видна независимо от флажка «Подробная информация».

Отметка готовности куска работает одинаково в обоих табах — тот же
`isPieceDone`/`onTogglePiece` по `linkId`, никакой отдельной логики
готовности для таба по толщине.

### 4–6. Блок статистики

- **Лэйаут (4):** см. секцию `widgets/insulation-stats` выше — грид на
  десктопе, столбец на мобиле.
- **Толщина текстом (5):** см. секцию `widgets/insulation-stats` выше —
  `<ul>` вместо `BarChart`, без процентов (bar-чарт их тоже не показывал).
- **Порядок на странице (6):** см. `InsulationPage.tsx` выше.

## Тестирование

По конвенции проекта (нет RTL/MSW-инфраструктуры) — автотесты только на
чистые функции:

- `groupByThickness` — юнит-тесты, аналогично существующим
  `summarizeByGroup.test.ts`/`summarizeByThickness.test.ts`.
- Логика вычисления подписи тумблера свернуть/развернуть, если вынесена в
  отдельную чистую функцию — покрывается тестом; если остаётся инлайн в
  компоненте/хуке — проверяется вручную.
- `useLocalStorageState` не тестируется отдельно — тривиальная обёртка над
  Web Storage API.

Остальное — ручная проверка через `pnpm dev`:
- переключение табов «По группам» / «По толщине», персист выбора между
  перезагрузками страницы;
- флажок «Подробная информация» — вкл/выкл на обоих табах, персист между
  перезагрузками;
- тумблер свернуть/развернуть — все три состояния (все свёрнуты, все
  развёрнуты, частично) дают правильную подпись кнопки;
- сетка по толщине: метка группы на карточке видна и в свёрнутом, и в
  подробном режиме; секции отсортированы по возрастанию толщины;
- responsive-раскладка блока статистики на десктопе (легенда справа) и
  мобиле (легенда под чартом);
- новый порядок виджетов на странице визуально корректен на обоих
  брейкпоинтах.

## Вне рамок

- Массовая отметка готовности по толщине (по секции в табе «По толщине») —
  осознанно не делаем, эта функциональность осталась только у групп.
- Персист `openGroupIds` (какие именно группы свёрнуты) между сессиями —
  персистятся только флажок детализации и активный таб.
- Изменение схемы PocketBase — не требуется, `groupId` на куске — чисто
  фронтенд-расширение производного join-типа.
