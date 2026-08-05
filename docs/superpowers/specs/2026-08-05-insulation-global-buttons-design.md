# Фаза 2 изоляции, инкремент 3: глобальные кнопки отметки готовности

Третий инкремент «Списка изоляции и отслеживания прогресса нарезания»
(`docs/spec.md` → раздел с этим названием, строка про «отметить все готовым,
снять готовность и сохранить»). Строится поверх инкремента 2 (групповые
кнопки в `InsulationGroupItem`, `docs/superpowers/specs/2026-08-04-insulation-group-toggle-design.md`,
смёржен в `master`) — переиспользует тот же `setGroupDone`/дебаунс/flush без
изменений в хуке.

## Контекст

Сейчас можно отметить готовность одного куска (`InsulationPieceCard`) или
всех кусков одной группы (кнопки в `InsulationGroupItem`). Нужны ещё две
кнопки уровня страницы — отметить готовыми/снять готовность **со всех кусков
всех групп** текущего набора изоляции (текущая установка + выбранная версия
набора).

## Явно вне рамок этого инкремента

- Кнопка «Сохранить» (финализация сессии, обновление
  `units.lastCompletedUnitNoInsulation`) — отдельный последующий инкремент
  (см. инкремент 2, не пересматривается здесь).
- Статистика и графики — пункт 3 фазы 2, не этот инкремент. Блок статистики
  по `docs/spec.md` должен в итоге оказаться между списком групп и этими
  кнопками — пока его нет, кнопки временно идут сразу под списком.
- Миграция набора иконок проекта — не связана с этим инкрементом, продолжаем
  переиспользовать существующие `mark-all.svg`/`close.svg` (те же, что в
  групповых кнопках инкремента 2).

## Данные и API

### Новый эндпоинт — `entities/insulation-piece`

Групповой эндпоинт `getPiecesForGroup(groupId)` не годится напрямую для
агрегата по всему набору: каждый кусок сейчас грузится покомпонентно внутри
`InsulationGroupItem`, а на уровне страницы/списка кусков нет вовсе.
Добавляем bulk-эндпоинт, параллельный уже существующему `getGroupsForSet`:

```ts
getPiecesForGroups: builder.query<InsulationPieceWithQuantity[], InsulationGroupId[]>({
  query: (groupIds) => ({
    collection: 'group_pieces',
    method: 'getFullList',
    params: { filter: /* group ∈ groupIds — точный синтаксис PocketBase-фильтра уточняется в плане реализации */, sort: 'order', expand: 'piece' },
  }),
  transformResponse: /* та же трансформация в InsulationPieceWithQuantity[], что и в getPiecesForGroup */,
  providesTags: (result, _error, groupIds) => [
    ...(result?.map(({ id }) => ({ type: 'InsulationPiece' as const, id })) ?? []),
    ...groupIds.map((groupId) => ({ type: 'InsulationPiece' as const, id: `GROUP_${groupId}` })),
  ],
}),
```

- Тегирование по `GROUP_${groupId}` для каждого id из аргумента — тот же тег,
  что уже расставляет `getPiecesForGroup` и инвалидируют мутации над
  составом группы, так что кеш нового эндпоинта инвалидируется теми же
  событиями без дополнительных правок.
- Возвращает полные `InsulationPieceWithQuantity[]` (не урезанный тип) —
  используется только `linkId`, но отдельный урезанный тип ради этого не
  вводим (дублировал бы существующую трансформацию без пользы).
- `useGetPiecesForGroupsQuery(groupIds.length === 0 ? skipToken : groupIds)`
  — независимый от того, смонтированы ли отдельные `InsulationGroupItem` и
  раскрыты ли они в аккордеоне (список групп не виртуализирован, но
  зависимость от чужого кеша всё равно была бы более хрупкой связью между
  двумя независимыми виджетами).

### Sentinel-ключ — `features/insulation-progress`

Изменений в `useInsulationProgress` не требуется — `setGroupDone(groupId,
groupPieceIds, done)` уже трактует `groupId` как непрозрачный ключ только для
`pendingGroupIds`. Экспортируем константу-код:

```ts
export const ALL_GROUPS_SENTINEL = '__all_groups__'
```

рядом с `applyBulk`/`isGroupDone` в `features/insulation-progress/index.ts`,
чтобы и новый виджет, и `onSetGroupDone` использовали один и тот же ключ без
дублирования магической строки.

## Новый виджет — `widgets/insulation-global-actions`

По аналогии с `widgets/insulation-group-list`.

### `model/useInsulationGlobalActions.ts`

Принимает `groups: InsulationGroupWithQuantity[]` и `isPieceDone: (id: string) => boolean`.

- `useGetPiecesForGroupsQuery` по `groups.map(g => g.id)`.
- `allPieceIds = pieces.map(p => p.linkId)`.
- `allDone = isGroupDone(allPieceIds, isPieceDone)` — переиспользует уже
  существующую чистую функцию из инкремента 1, без новой логики.
- `hasAnyDone = pieces.some(p => isPieceDone(p.linkId))`.
- `isLoading` — из самого запроса.

Возвращает `{ allPieceIds, allDone, hasAnyDone, isLoading }`.

### `ui/InsulationGlobalActions.tsx`

Пропсы — тот же набор, что уже прокидывается в `InsulationGroupList`:

```ts
interface InsulationGlobalActionsProps {
  groups: InsulationGroupWithQuantity[]
  isPieceDone: (groupPieceId: string) => boolean
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
}
```

- `isPending = pendingGroupIds.has(ALL_GROUPS_SENTINEL)`.
- Локальный `pressedAction: 'markAll' | 'unmark' | null` — тот же паттерн
  спиннера "какая кнопка нажата последней", что в `InsulationGroupItem`
  (сброс при переходе `isPending → false`, во время рендера).
- «Отметить всё готовым» (`MarkAllIcon`, `IconButton`): `aria-disabled` при
  `allDone || isPending`. Обработчик — без диалога подтверждения, сразу
  `onSetGroupDone(ALL_GROUPS_SENTINEL, allPieceIds, true)`.
- «Снять готовность» (`CloseIcon`, `IconButton`): `aria-disabled` при
  `!hasAnyDone || isPending`. Обработчик — сначала
  `window.confirm('Снять готовность со всех кусков набора?')` (по образцу
  `useBulkActions.ts`, деструктивное массовое действие с бо́льшим
  блэст-радиусом, чем у групповых кнопок), при отказе — no-op; при
  подтверждении — `onSetGroupDone(ALL_GROUPS_SENTINEL, allPieceIds, false)`.
- Ничего не рендерит, если `groups.length === 0 || isLoading` (эквивалент
  скрытия групповых кнопок при `pieces.length === 0 || isLoading`, но на
  уровне всего набора).

### `InsulationPage`

Рендерит `InsulationGlobalActions` отдельной строкой сразу под
`InsulationGroupList`, передавая туда те же `groups`/`isPieceDone`/
`pendingGroupIds`/`onSetGroupDone`, что уже идут в список. Никакой новой
логики на уровне страницы.

## Обработка ошибок

Без изменений относительно инкрементов 1–2 — `updateDonePieces` сам
ресинкается по ошибке через инвалидацию тега `CuttingSession`, и
`pendingGroupIds` корректно очищается в `flush()` независимо от того, какой
ключ (групповой или `ALL_GROUPS_SENTINEL`) в нём накопился.

## Тестирование

- Новой чистой логики, требующей юнит-тестов, нет — `isGroupDone` уже
  покрыт тестами в инкременте 1, здесь просто вызывается с другим списком
  id.
- Ручная проверка через `pnpm dev`:
  - скрытие кнопок при пустом/загружающемся наборе;
  - disabled-логика обеих кнопок по отдельности (все готово / ничего не
    готово / частично);
  - спиннер только на нажатой кнопке, вторая просто disabled;
  - `window.confirm` перед «Снять готовность» — отмена в диалоге не должна
    менять состояние;
  - совместная работа с групповыми кнопками — глобальное действие не ломает
    состояние отдельных групп и наоборот, счётчики/бейджи групп обновляются
    сразу (оптимистичный патч кеша общий для toggle/setGroupDone);
  - работа с клавиатуры (фокус/Enter/Space через `IconButton`, `aria-disabled`
    не выкидывает из таб-порядка).
- `pnpm check` — обязательно перед коммитом.
