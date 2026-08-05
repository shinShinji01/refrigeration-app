# Инкремент 3 фазы 2 изоляции: глобальные кнопки отметки готовности — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить две кнопки уровня страницы («Отметить всё готовым» / «Снять готовность»), которые отмечают готовыми/снимают готовность со всех кусков всех групп текущего набора изоляции — поверх уже смёрженных инкрементов 1 (одиночная отметка) и 2 (групповые кнопки).

**Architecture:** Новый bulk-эндпоинт `getPiecesForGroups` в `entities/insulation-piece` даёт плоский список кусков по всем группам набора одним запросом (без зависимости от того, что и как уже закешировали `InsulationGroupItem`-компоненты). Новый виджет `widgets/insulation-global-actions` строит на этом списке агрегаты (`allDone`/`hasAnyDone`) через уже существующую чистую функцию `isGroupDone`, и вызывает уже существующий `setGroupDone` из `useInsulationProgress` с sentinel-ключом `ALL_GROUPS_SENTINEL` — никаких изменений в самом хуке/дебаунсе.

**Tech Stack:** React 19 + TypeScript, RTK Query (кастомный `pocketbaseBaseQuery`), SASS modules, Vitest (только там, где это уже применимо — см. Global Constraints).

## Global Constraints

- Работаем на ветке `feature/insulation-global-buttons` (уже создана и checked out поверх `df68e0b`). Не мержить и не пушить без явной команды пользователя.
- Диалог подтверждения (`window.confirm`) — только перед «Снять готовность»; «Отметить всё готовым» — без диалога (см. спеку, раздел про `InsulationGlobalActions`).
- Новых юнит-тестов в этом плане нет: единственная переиспользуемая чистая функция (`isGroupDone`) уже протестирована в инкременте 1; RTK Query хуки в этом проекте не покрываются юнит-тестами (нет прецедента MSW), проверяются вручную через `pnpm dev` — см. спеку, раздел «Тестирование».
- Каждая задача заканчивается `pnpm typecheck` (и `pnpm lint` там, где меняется код, а не только конфиг) — зелёным, прежде чем коммитить.
- `pnpm check` обязателен перед последним коммитом плана.
- Коммиты — атомарные, по-русски, в повелительном наклонении (см. `CLAUDE.md`).
- Спека: `docs/superpowers/specs/2026-08-05-insulation-global-buttons-design.md` — при расхождении план должен ей соответствовать, а не наоборот.

---

## Файловая структура

**Создаются:**
- `src/features/insulation-progress/lib/allGroupsSentinel.ts` — sentinel-константа.
- `src/widgets/insulation-global-actions/model/useInsulationGlobalActions.ts` — агрегация «все куски набора» + `allDone`/`hasAnyDone`.
- `src/widgets/insulation-global-actions/ui/InsulationGlobalActions.tsx` — сами кнопки.
- `src/widgets/insulation-global-actions/ui/InsulationGlobalActions.module.scss` — стили.
- `src/widgets/insulation-global-actions/index.ts` — публичный экспорт виджета.

**Меняются:**
- `src/entities/insulation-piece/api/insulationPieceApi.ts` — новый эндпоинт `getPiecesForGroups` (+ мелкий DRY-рефакторинг: общая `toPiecesWithQuantity` вместо дублирования `transformResponse` в двух эндпоинтах).
- `src/entities/insulation-piece/index.ts` — экспорт `useGetPiecesForGroupsQuery`.
- `src/features/insulation-progress/index.ts` — экспорт `ALL_GROUPS_SENTINEL`.
- `src/pages/insulation/ui/InsulationPage.tsx` — рендер `InsulationGlobalActions` под `InsulationGroupList`.

---

### Task 1: Bulk-эндпоинт `getPiecesForGroups`

**Files:**
- Modify: `src/entities/insulation-piece/api/insulationPieceApi.ts`
- Modify: `src/entities/insulation-piece/index.ts`

**Interfaces:**
- Produces: `useGetPiecesForGroupsQuery(groupIds: InsulationGroupId[] | typeof skipToken): { data?: InsulationPieceWithQuantity[], isLoading: boolean }` — используется в Task 3.

- [ ] **Step 1: Заменить содержимое `insulationPieceApi.ts`**

Текущий файл дублировал бы `transformResponse` между двумя эндпоинтами — выносим общую функцию `toPiecesWithQuantity`, затем добавляем новый эндпоинт `getPiecesForGroups`, который фильтрует по нескольким `group` через OR-цепочку `pb.filter` (в PocketBase filter-синтаксисе нет встроенного "IN" по одиночному relation-полю — стандартный способ, задокументированный в JS SDK, это `join(' || ')` из отдельно экранированных условий):

```ts
import { baseApi, pb } from '@/shared/api'
import type { InsulationGroupId } from '@/entities/insulation-group'
import type { InsulationPiece, InsulationPieceWithQuantity } from '../model/types'

// group_pieces: group (rel), piece (rel), quantity, order — см. docs/data-model.md.
interface GroupPieceRecord {
  id: string
  group: string
  piece: string
  quantity: number
  order: number
  expand?: { piece: InsulationPiece }
}

const withDrawingNumbers = (piece: InsulationPiece): InsulationPiece => ({
  ...piece,
  drawingNumbers: piece.drawingNumbers ?? [],
})

const toPiecesWithQuantity = (links: GroupPieceRecord[]): InsulationPieceWithQuantity[] =>
  links
    .filter((link) => link.expand?.piece)
    .map((link) => ({
      ...withDrawingNumbers(link.expand!.piece),
      quantity: link.quantity,
      order: link.order,
      linkId: link.id,
    }))

export const insulationPieceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Куски конкретной группы, в порядке показа (docs/spec.md → "Список
    // изоляции и отслеживание прогресса нарезания").
    getPiecesForGroup: builder.query<InsulationPieceWithQuantity[], InsulationGroupId>({
      query: (groupId) => ({
        collection: 'group_pieces',
        method: 'getFullList',
        params: {
          filter: pb.filter('group = {:groupId}', { groupId }),
          sort: 'order',
          expand: 'piece',
        },
      }),
      transformResponse: toPiecesWithQuantity,
      providesTags: (result, _error, groupId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'InsulationPiece' as const, id })),
              { type: 'InsulationPiece' as const, id: `GROUP_${groupId}` },
            ]
          : [{ type: 'InsulationPiece' as const, id: `GROUP_${groupId}` }],
    }),
    // Куски сразу по нескольким группам — агрегат "все ли куски набора
    // готовы" для глобальных кнопок уровня страницы
    // (widgets/insulation-global-actions), независимо от того, что уже
    // закешировали отдельные InsulationGroupItem.
    getPiecesForGroups: builder.query<InsulationPieceWithQuantity[], InsulationGroupId[]>({
      query: (groupIds) => ({
        collection: 'group_pieces',
        method: 'getFullList',
        params: {
          filter: groupIds.map((groupId) => pb.filter('group = {:groupId}', { groupId })).join(' || '),
          sort: 'order',
          expand: 'piece',
        },
      }),
      transformResponse: toPiecesWithQuantity,
      providesTags: (result, _error, groupIds) => [
        ...(result?.map(({ id }) => ({ type: 'InsulationPiece' as const, id })) ?? []),
        ...groupIds.map((groupId) => ({ type: 'InsulationPiece' as const, id: `GROUP_${groupId}` })),
      ],
    }),
  }),
})

export const { useGetPiecesForGroupQuery, useGetPiecesForGroupsQuery } = insulationPieceApi
```

- [ ] **Step 2: Обновить публичный экспорт entity**

`src/entities/insulation-piece/index.ts`:

```ts
export type { InsulationPieceId, InsulationPiece, InsulationPieceWithQuantity } from './model/types'
export { useGetPiecesForGroupQuery, useGetPiecesForGroupsQuery } from './api/insulationPieceApi'
export { summarizeByThickness } from './lib/summarizeByThickness'
export type { ThicknessSummary } from './lib/summarizeByThickness'
export { InsulationPieceCard } from './ui/InsulationPieceCard'
```

- [ ] **Step 3: Проверить типы**

Run: `pnpm typecheck`
Expected: без ошибок. Если TS ругается на `groupIds` в `providesTags` — убедиться, что аргумент у `getPiecesForGroups` совпадает с `builder.query<..., InsulationGroupId[]>`.

- [ ] **Step 4: Проверить линт**

Run: `pnpm lint`
Expected: без ошибок/предупреждений на изменённых файлах.

- [ ] **Step 5: Commit**

```bash
git add src/entities/insulation-piece/api/insulationPieceApi.ts src/entities/insulation-piece/index.ts
git commit -m "Добавь bulk-эндпоинт getPiecesForGroups"
```

---

### Task 2: Sentinel-ключ `ALL_GROUPS_SENTINEL`

**Files:**
- Create: `src/features/insulation-progress/lib/allGroupsSentinel.ts`
- Modify: `src/features/insulation-progress/index.ts`

**Interfaces:**
- Consumes: ничего (чистая константа).
- Produces: `ALL_GROUPS_SENTINEL: string` — используется в Task 4 (`InsulationGlobalActions`) и передаётся первым аргументом в уже существующий `setGroupDone` из `useInsulationProgress` (сигнатура не меняется: `setGroupDone(groupId: string, groupPieceIds: string[], done: boolean): void`).

- [ ] **Step 1: Создать файл константы**

```ts
// src/features/insulation-progress/lib/allGroupsSentinel.ts

// Ключ для pendingGroupIds, которым помечается глобальное bulk-действие
// (widgets/insulation-global-actions) — setGroupDone трактует groupId как
// непрозрачный идентификатор и ни на что другое не влияет, так что здесь
// достаточно константы, не пересекающейся с реальными group.linkId.
export const ALL_GROUPS_SENTINEL = '__all_groups__'
```

- [ ] **Step 2: Добавить в публичный экспорт фичи**

`src/features/insulation-progress/index.ts`:

```ts
export { useInsulationProgress } from './model/useInsulationProgress'
export { applyToggle } from './lib/applyToggle'
export { isGroupDone } from './lib/isGroupDone'
export { applyBulk } from './lib/applyBulk'
export { ALL_GROUPS_SENTINEL } from './lib/allGroupsSentinel'
```

- [ ] **Step 3: Проверить типы**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/features/insulation-progress/lib/allGroupsSentinel.ts src/features/insulation-progress/index.ts
git commit -m "Добавь ALL_GROUPS_SENTINEL для глобального bulk-действия"
```

---

### Task 3: Хук `useInsulationGlobalActions`

**Files:**
- Create: `src/widgets/insulation-global-actions/model/useInsulationGlobalActions.ts`

**Interfaces:**
- Consumes: `useGetPiecesForGroupsQuery` (Task 1), `isGroupDone` из `@/features/insulation-progress` (уже существует).
- Produces:
  ```ts
  useInsulationGlobalActions(
    groups: InsulationGroupWithQuantity[],
    isPieceDone: (groupPieceId: string) => boolean,
  ): { allPieceIds: string[], allDone: boolean, hasAnyDone: boolean, isLoading: boolean }
  ```
  Используется в Task 4 (`InsulationGlobalActions`). `isLoading` здесь — только про сам bulk-запрос кусков; отдельно от него компонент в Task 4 получит ещё и внешний `isLoading` (проп со страницы, эквивалент `isFetching` из `InsulationPage`) и должен учитывать оба.

- [ ] **Step 1: Написать хук**

```ts
// src/widgets/insulation-global-actions/model/useInsulationGlobalActions.ts
import { skipToken } from '@reduxjs/toolkit/query/react'
import { useGetPiecesForGroupsQuery } from '@/entities/insulation-piece'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { isGroupDone } from '@/features/insulation-progress'

export const useInsulationGlobalActions = (
  groups: InsulationGroupWithQuantity[],
  isPieceDone: (groupPieceId: string) => boolean,
) => {
  const groupIds = groups.map((group) => group.id)
  const { data: pieces = [], isLoading } = useGetPiecesForGroupsQuery(
    groupIds.length === 0 ? skipToken : groupIds,
  )

  const allPieceIds = pieces.map((piece) => piece.linkId)
  const allDone = isGroupDone(allPieceIds, isPieceDone)
  const hasAnyDone = pieces.some((piece) => isPieceDone(piece.linkId))

  return { allPieceIds, allDone, hasAnyDone, isLoading }
}
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm typecheck`
Expected: без ошибок. (Юнит-теста нет намеренно — см. Global Constraints; вся использованная логика уже покрыта тестами `isGroupDone`, здесь только композиция RTK Query + маппинг.)

- [ ] **Step 3: Commit**

```bash
git add src/widgets/insulation-global-actions/model/useInsulationGlobalActions.ts
git commit -m "Добавь useInsulationGlobalActions"
```

---

### Task 4: Виджет `InsulationGlobalActions`

**Files:**
- Create: `src/widgets/insulation-global-actions/ui/InsulationGlobalActions.tsx`
- Create: `src/widgets/insulation-global-actions/ui/InsulationGlobalActions.module.scss`
- Create: `src/widgets/insulation-global-actions/index.ts`

**Interfaces:**
- Consumes: `useInsulationGlobalActions` (Task 3), `ALL_GROUPS_SENTINEL` (Task 2), `IconButton` из `@/shared/ui`, иконки `mark-all.svg`/`close.svg` из `@/shared/assets/icons` (уже существуют, используются в `InsulationGroupItem`).
- Produces: компонент
  ```ts
  interface InsulationGlobalActionsProps {
    groups: InsulationGroupWithQuantity[]
    isLoading: boolean
    isPieceDone: (groupPieceId: string) => boolean
    pendingGroupIds: ReadonlySet<string>
    onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
  }
  export const InsulationGlobalActions: (props: InsulationGlobalActionsProps) => JSX.Element | null
  ```
  Пропсы `isLoading`/`isPieceDone`/`pendingGroupIds`/`onSetGroupDone` — те же значения, что уже идут в `InsulationGroupList` со страницы (см. Task 5): `isLoading` — это `isFetching` со страницы (не путать с внутренним `isLoading` хука из Task 3, который про сам bulk-запрос кусков; компонент прячет себя при истинности любого из двух — иначе при смене версии набора виджет держит в кадре куски **старой** версии, пока `InsulationGroupList` уже скрылся по своему `isLoading`).

- [ ] **Step 1: Написать стили**

```scss
// src/widgets/insulation-global-actions/ui/InsulationGlobalActions.module.scss
.root {
  @include card-surface;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-2;
  padding: $space-3;
}

.label {
  color: $color-text-muted;
  font-size: 0.875rem;
}

.actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: $space-1;
}
```

- [ ] **Step 2: Написать компонент**

```tsx
// src/widgets/insulation-global-actions/ui/InsulationGlobalActions.tsx
import { useState } from 'react'
import MarkAllIcon from '@/shared/assets/icons/mark-all.svg?react'
import CloseIcon from '@/shared/assets/icons/close.svg?react'
import { IconButton } from '@/shared/ui'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { ALL_GROUPS_SENTINEL } from '@/features/insulation-progress'
import { useInsulationGlobalActions } from '../model/useInsulationGlobalActions'
import styles from './InsulationGlobalActions.module.scss'

type PressedAction = 'markAll' | 'unmark' | null

interface InsulationGlobalActionsProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
  isPieceDone: (groupPieceId: string) => boolean
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
}

export const InsulationGlobalActions = ({
  groups,
  isLoading,
  isPieceDone,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGlobalActionsProps) => {
  const { allPieceIds, allDone, hasAnyDone, isLoading: piecesLoading } = useInsulationGlobalActions(
    groups,
    isPieceDone,
  )
  const isPending = pendingGroupIds.has(ALL_GROUPS_SENTINEL)

  // Какая из двух кнопок нажата последней — тот же паттерн, что в
  // InsulationGroupItem: спиннер только на нажатой, вторая просто disabled.
  const [pressedAction, setPressedAction] = useState<PressedAction>(null)
  const [prevIsPending, setPrevIsPending] = useState(isPending)
  if (isPending !== prevIsPending) {
    setPrevIsPending(isPending)
    if (!isPending) setPressedAction(null)
  }

  if (isLoading || piecesLoading || allPieceIds.length === 0) {
    return null
  }

  const handleMarkAll = () => {
    if (allDone || isPending) return
    setPressedAction('markAll')
    onSetGroupDone(ALL_GROUPS_SENTINEL, allPieceIds, true)
  }

  const handleUnmark = () => {
    if (!hasAnyDone || isPending) return
    if (!window.confirm('Снять готовность со всех кусков набора?')) return
    setPressedAction('unmark')
    onSetGroupDone(ALL_GROUPS_SENTINEL, allPieceIds, false)
  }

  return (
    <div className={styles.root}>
      <span className={styles.label}>Весь набор изоляции</span>
      <span className={styles.actions}>
        <IconButton
          icon={MarkAllIcon}
          label="Отметить всё готовым"
          loading={isPending && pressedAction === 'markAll'}
          aria-disabled={allDone || isPending}
          onClick={handleMarkAll}
        />
        <IconButton
          icon={CloseIcon}
          label="Снять готовность"
          loading={isPending && pressedAction === 'unmark'}
          aria-disabled={!hasAnyDone || isPending}
          onClick={handleUnmark}
        />
      </span>
    </div>
  )
}
```

- [ ] **Step 3: Публичный экспорт виджета**

```ts
// src/widgets/insulation-global-actions/index.ts
export { InsulationGlobalActions } from './ui/InsulationGlobalActions'
```

- [ ] **Step 4: Проверить типы и линт**

Run: `pnpm typecheck && pnpm lint`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/insulation-global-actions
git commit -m "Добавь виджет InsulationGlobalActions с глобальными кнопками отметки готовности"
```

---

### Task 5: Подключить на странице + ручная проверка

**Files:**
- Modify: `src/pages/insulation/ui/InsulationPage.tsx` (весь файл, см. Step 1 — сейчас 49 строк)

**Interfaces:**
- Consumes: `InsulationGlobalActions` (Task 4), уже существующие `groups`, `isFetching`, `isPieceDone`, `pendingGroupIds`, `setGroupDone` из `InsulationPage`.

- [ ] **Step 1: Обновить `InsulationPage.tsx`**

Добавить импорт и обернуть текущий JSX-фрагмент (`InsulationGroupList`) во фрагмент вместе с новым виджетом — `.root` уже flex-column с `gap: $space-3`, так что доп. обёрточный `<div>` не нужен, фрагмент отрендерит оба как прямых flex-детей:

```tsx
import { skipToken } from '@reduxjs/toolkit/query/react'
import { useInsulationSetFilter, InsulationFilterBar } from '@/features/insulation-set-filter'
import { useInsulationProgress } from '@/features/insulation-progress'
import { useGetGroupsForSetQuery } from '@/entities/insulation-group'
import { InsulationGroupList } from '@/widgets/insulation-group-list'
import { InsulationGlobalActions } from '@/widgets/insulation-global-actions'
import { EmptyState } from '@/shared/ui'
import styles from './InsulationPage.module.scss'

export const InsulationPage = () => {
  const { unitId, selectedSetId } = useInsulationSetFilter()
  // currentData (не data) и isFetching (не isLoading) — иначе на смене версии
  // набора один рендер отдаёт группы СТАРОЙ версии при уже новом selectedSetId
  // (RTK Query отдаёт data от предыдущего arg, пока грузится новый), и именно
  // в этот рендер из-за key={selectedSetId} монтируется свежий Accordion —
  // получая в defaultValue чужие linkId. currentData/isFetching гарантируют,
  // что список не рендерится, пока данные не соответствуют текущей версии.
  const { currentData: groups = [], isFetching } = useGetGroupsForSetQuery(selectedSetId ?? skipToken)
  const { isPieceDone, toggle, setGroupDone, pendingGroupIds } = useInsulationProgress({
    unitId,
    setId: selectedSetId,
  })

  return (
    <div className={styles.root}>
      <h1>Изоляция и раскрой</h1>
      <InsulationFilterBar />
      {!unitId ? (
        <EmptyState message="Выберите установку" />
      ) : !selectedSetId ? (
        <EmptyState message="У установки нет набора изоляции" />
      ) : (
        <>
          {/* key — при смене версии набора список групп (и их linkId, по которым
              Accordion помнит развёрнутые пункты) полностью меняется; без key
              React переиспользовал бы тот же компонент, и всё оказывалось бы
              свёрнутым, т.к. старые linkId не совпадают с новыми. */}
          <InsulationGroupList
            key={selectedSetId}
            groups={groups}
            isLoading={isFetching}
            isPieceDone={isPieceDone}
            onTogglePiece={toggle}
            pendingGroupIds={pendingGroupIds}
            onSetGroupDone={setGroupDone}
          />
          <InsulationGlobalActions
            groups={groups}
            isLoading={isFetching}
            isPieceDone={isPieceDone}
            pendingGroupIds={pendingGroupIds}
            onSetGroupDone={setGroupDone}
          />
        </>
      )}
    </div>
  )
}
```

Оба существующих комментария (`currentData`/`isFetching` и про `key={selectedSetId}`) сохранены выше как есть — они по-прежнему верны и относятся к `InsulationGroupList`; второй при переносе в `<>` меняет синтаксис с `//` на `{/* */}`, т.к. становится JSX-ребёнком фрагмента, а не значением тернарника.

- [ ] **Step 2: Проверить типы и линт**

Run: `pnpm typecheck && pnpm lint`
Expected: без ошибок.

- [ ] **Step 3: Ручная проверка через `pnpm dev`**

Открыть страницу изоляции и проверить (см. спеку, раздел «Тестирование»):
- кнопки скрыты, пока набор/список групп грузится, и при пустом наборе (нет групп или во всех группах 0 кусков);
- «Отметить всё готовым» неактивна, когда уже всё готово; кликабельна и мгновенно (оптимистично) помечает готовыми все куски всех групп, когда не всё готово;
- «Снять готовность» неактивна, когда ничего не готово; при клике — `window.confirm`, при отмене состояние не меняется, при подтверждении снимает готовность со всех кусков;
- во время ожидания сети (окно ~500мс дебаунса) — спиннер только на нажатой кнопке, вторая просто disabled;
- бейджи/чекбоксы отдельных групп и кусков обновляются сразу же и синхронно с глобальным действием (общий кеш `donePieces`);
- клик по групповым/одиночным кнопкам не конфликтует с глобальными и наоборот;
- работа с клавиатуры — фокус, `Enter`/`Space` на обеих новых кнопках;
- смена версии набора (если у установки их несколько) не показывает кнопки со старыми данными в момент подгрузки новой версии.

- [ ] **Step 4: Финальная проверка перед коммитом**

Run: `pnpm check`
Expected: typecheck + lint + test — все зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/pages/insulation/ui/InsulationPage.tsx
git commit -m "Подключи глобальные кнопки отметки готовности изоляции на странице"
```
