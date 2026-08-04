# Групповые кнопки отметки готовности изоляции — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** В шапке каждой группы изоляции (`InsulationGroupItem`) добавить две кнопки — «Отметить всё готовым» и «Снять готовность» — которые массово переключают статус готовности всех кусков группы, используя ту же оптимистичную запись и дебаунс, что уже работает для одиночного тоггла куска.

**Architecture:** Новая чистая функция `applyBulk` (аналог `applyToggle`, но для множества ключей) применяется в новом методе `setGroupDone` хука `useInsulationProgress`. Хук получает состояние `pendingGroupIds` (`Set`, не единственное значение — общий 500мс дебаунс может успеть накопить клики по нескольким группам), общий с `toggle` таймер/`flush`. UI-часть — две новые кнопки в `InsulationGroupItem`, спиннер на нажатой кнопке через новый `loading`-проп `IconButton`. Пропсы прокидываются вниз без логики через `InsulationGroupList` и собираются в `InsulationPage`.

**Tech Stack:** React 19 + TypeScript strict, Redux Toolkit / RTK Query (`updateQueryData` для оптимистичного патча кеша), Radix UI Accordion, SASS modules, Vitest.

**Спека:** `docs/superpowers/specs/2026-08-04-insulation-group-toggle-design.md`

## Global Constraints

- Изменений в `entities/cutting-session` не требуется — `updateDonePieces` уже принимает произвольный `donePieces`.
- Вне рамок: глобальные кнопки на странице, кнопка «Сохранить» (финализация сессии), статистика/графики, миграция иконок на готовый пакет — продолжаем рисовать кастомные stroke-SVG в `shared/assets/icons`.
- `setGroupDone(groupId: string, groupPieceIds: string[], done: boolean): void` — первый аргумент это `group.linkId` (та же id, что уже используется как `Accordion.Item value`), не `group.id`.
- `pendingGroupIds` — `ReadonlySet<string>` через `useState` (не `useRef`, должно вызывать перерисовку); общий таймер `flush` с `toggle`, отдельного таймера на группу нет.
- `flush` при завершении (успех **или** ошибка — ошибка уже обрабатывается существующим `onQueryStarted` через ресинк по тегу `CuttingSession`) полностью очищает `pendingGroupIds` целиком, а не по одному `groupId`.
- Кнопки — соседний с `Accordion.Trigger` элемент внутри `Accordion.Header`, не вложенные в `Trigger` (Radix рендерит `Trigger` как нативный `<button>`, вложенные `<button>` невалидны).
- Кнопки не рендерятся, если `pieces.length === 0` или `isLoading`.
- «Отметить всё готовым»: `disabled` при `allDone || isPending`. «Снять готовность»: `disabled` при `!hasAnyDone || isPending`.
- Пока `isPending` — обе кнопки группы `disabled`; спиннер показывается только на той, что была нажата последней (локальное состояние `useState` в `InsulationGroupItem`, сбрасывается когда `isPending` становится `false`).
- Название группы — эллипсис (`text-overflow: ellipsis; white-space: nowrap; overflow: hidden`) + атрибут `title={group.name}`.
- Никаких юнит-тестов на хук/дебаунс (нет прецедента тестирования RTK Query хуков через MSW в проекте) — только ручная проверка через `pnpm dev`.
- `pnpm check` — обязательно перед каждым коммитом.

---

### Task 1: `applyBulk` — чистая функция массового применения статуса

**Files:**
- Create: `src/features/insulation-progress/lib/applyBulk.ts`
- Test: `src/features/insulation-progress/lib/applyBulk.test.ts`
- Modify: `src/features/insulation-progress/index.ts`

**Interfaces:**
- Produces: `applyBulk(donePieces: Record<string, true>, groupPieceIds: string[], done: boolean): Record<string, true>` — используется в Task 3 (`useInsulationProgress`).

- [ ] **Step 1: Написать падающие тесты**

```ts
// src/features/insulation-progress/lib/applyBulk.test.ts
import { describe, expect, it } from 'vitest'
import { applyBulk } from './applyBulk'

describe('applyBulk', () => {
  it('добавляет все переданные ключи при done=true', () => {
    expect(applyBulk({}, ['gp-1', 'gp-2'], true)).toEqual({ 'gp-1': true, 'gp-2': true })
  })

  it('убирает все переданные ключи при done=false', () => {
    expect(applyBulk({ 'gp-1': true, 'gp-2': true, 'gp-3': true }, ['gp-1', 'gp-2'], false)).toEqual({
      'gp-3': true,
    })
  })

  it('не трогает ключи, не входящие в groupPieceIds', () => {
    expect(applyBulk({ 'gp-9': true }, ['gp-1'], true)).toEqual({ 'gp-9': true, 'gp-1': true })
  })

  it('пустой groupPieceIds не меняет содержимое', () => {
    expect(applyBulk({ 'gp-1': true }, [], true)).toEqual({ 'gp-1': true })
    expect(applyBulk({ 'gp-1': true }, [], false)).toEqual({ 'gp-1': true })
  })

  it('идемпотентна: повторный вызов с тем же done ничего не меняет', () => {
    const once = applyBulk({}, ['gp-1', 'gp-2'], true)
    const twice = applyBulk(once, ['gp-1', 'gp-2'], true)
    expect(twice).toEqual(once)

    const cleared = applyBulk(twice, ['gp-1', 'gp-2'], false)
    const clearedAgain = applyBulk(cleared, ['gp-1', 'gp-2'], false)
    expect(clearedAgain).toEqual(cleared)
  })

  it('всегда возвращает новый объект', () => {
    const original = { 'gp-1': true }
    expect(applyBulk(original, ['gp-1'], true)).not.toBe(original)
    expect(applyBulk(original, ['gp-1'], false)).not.toBe(original)
  })
})
```

- [ ] **Step 2: Убедиться, что тесты падают (функции ещё нет)**

Run: `pnpm exec vitest run src/features/insulation-progress/lib/applyBulk.test.ts`
Expected: FAIL — `Cannot find module './applyBulk'`

- [ ] **Step 3: Реализовать `applyBulk`**

```ts
// src/features/insulation-progress/lib/applyBulk.ts
export const applyBulk = (
  donePieces: Record<string, true>,
  groupPieceIds: string[],
  done: boolean,
): Record<string, true> => {
  const next = { ...donePieces }
  for (const id of groupPieceIds) {
    if (done) {
      next[id] = true
    } else {
      delete next[id]
    }
  }
  return next
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Run: `pnpm exec vitest run src/features/insulation-progress/lib/applyBulk.test.ts`
Expected: PASS (6 тестов)

- [ ] **Step 5: Добавить публичный экспорт**

В `src/features/insulation-progress/index.ts` (сейчас 3 строки: `useInsulationProgress`, `applyToggle`, `isGroupDone`) добавить четвёртой строкой:

```ts
export { applyBulk } from './lib/applyBulk'
```

- [ ] **Step 6: Коммит**

```bash
git add src/features/insulation-progress/lib/applyBulk.ts src/features/insulation-progress/lib/applyBulk.test.ts src/features/insulation-progress/index.ts
git commit -m "Добавь applyBulk для массовой отметки готовности группы"
```

---

### Task 2: `IconButton` — поддержка состояния загрузки (спиннер)

Генерическое расширение `shared/ui`, без доменной привязки — используется Task 4 для отображения спиннера на нажатой кнопке группы, пока идёт запись на сервер.

**Files:**
- Modify: `src/shared/ui/IconButton/IconButton.tsx`
- Modify: `src/shared/ui/IconButton/IconButton.module.scss`

**Interfaces:**
- Produces: `IconButtonProps.loading?: boolean` — при `true` рендерит спиннер вместо `icon` и выставляет `aria-busy`. Используется в Task 4.

- [ ] **Step 1: Добавить проп `loading` в `IconButton`**

Полное содержимое `src/shared/ui/IconButton/IconButton.tsx`:

```tsx
import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react'
import clsx from 'clsx'
import styles from './IconButton.module.scss'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  loading?: boolean
}

export const IconButton = ({ icon: Icon, label, loading = false, className, ...rest }: IconButtonProps) => {
  return (
    <button
      type="button"
      aria-label={label}
      aria-busy={loading || undefined}
      className={clsx(styles.root, className)}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        <Icon className={styles.icon} aria-hidden="true" />
      )}
    </button>
  )
}
```

- [ ] **Step 2: Добавить стили спиннера**

Полное содержимое `src/shared/ui/IconButton/IconButton.module.scss`:

```scss
.root {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  @include touch-target;

  border-radius: $radius-sm;
  color: $color-text-muted;
  transition:
    background-color $duration-fast $easing-standard,
    color $duration-fast $easing-standard;

  &:hover {
    background: $color-accent-cyan-muted;
    color: $color-text;
  }

  &:focus-visible {
    @include focus-ring;
  }

  &:disabled {
    color: $color-text-disabled;
  }

  &[aria-pressed='true'] {
    background: $color-accent-cyan-muted;
    color: $color-accent-cyan;
  }
}

.icon {
  width: 20px;
  height: 20px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: icon-spin 700ms linear infinite;
}

@keyframes icon-spin {
  to {
    transform: rotate(360deg);
  }
}

@include reduced-motion {
  .spinner {
    animation: none;
    opacity: 0.6;
  }
}
```

- [ ] **Step 3: Проверить типы и линт**

Run: `pnpm typecheck && pnpm lint`
Expected: без ошибок — `loading` опционален, существующие вызовы `IconButton` (`SelectionToolbar`, `ComponentEditModal`, `ChildrenPickerField`, `Modal`, `Sidebar`, `ComponentCard`) не меняют поведения.

- [ ] **Step 4: Коммит**

```bash
git add src/shared/ui/IconButton/IconButton.tsx src/shared/ui/IconButton/IconButton.module.scss
git commit -m "Добавь состояние загрузки (спиннер) в IconButton"
```

---

### Task 3: `useInsulationProgress` — `setGroupDone` и `pendingGroupIds`

**Files:**
- Modify: `src/features/insulation-progress/model/useInsulationProgress.ts`

**Interfaces:**
- Consumes: `applyBulk` из Task 1 (`src/features/insulation-progress/lib/applyBulk.ts`).
- Produces: хук теперь возвращает `{ isPieceDone, toggle, setGroupDone, pendingGroupIds, isLoading }`, где `setGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void` и `pendingGroupIds: ReadonlySet<string>`. Используется в Task 6 (`InsulationPage`).

- [ ] **Step 1: Реализовать `setGroupDone` и `pendingGroupIds`**

Полное содержимое `src/features/insulation-progress/model/useInsulationProgress.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query/react'
import { useAppDispatch, useAppStore } from '@/app/store'
import { useGetFirstUserQuery } from '@/entities/user'
import { useGetUnitsQuery } from '@/entities/refrigeration-unit'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'
import {
  cuttingSessionApi,
  useGetActiveCuttingSessionQuery,
  useUpdateDonePiecesMutation,
} from '@/entities/cutting-session'
import type { GetActiveCuttingSessionArgs } from '@/entities/cutting-session'
import { applyToggle } from '../lib/applyToggle'
import { applyBulk } from '../lib/applyBulk'

const FLUSH_DELAY_MS = 500

interface UseInsulationProgressArgs {
  unitId: UnitId | null
  setId: InsulationSetId | null
}

export const useInsulationProgress = ({ unitId, setId }: UseInsulationProgressArgs) => {
  const dispatch = useAppDispatch()
  const store = useAppStore()
  const { data: user } = useGetFirstUserQuery()
  // Тот же кеш, что уже прогрет InsulationFilterBar — лишнего запроса нет.
  const { data: units = [] } = useGetUnitsQuery({ includeArchived: false })

  const unit = units.find((candidate) => candidate.id === unitId) ?? null
  const unitNo = unit ? (unit.lastCompletedUnitNoInsulation ?? 0) + 1 : null

  const sessionArgs: GetActiveCuttingSessionArgs | typeof skipToken =
    unitId && setId && unitNo !== null && user ? { unitId, setId, unitNo, userId: user.id } : skipToken

  const { data: session, isLoading } = useGetActiveCuttingSessionQuery(sessionArgs)
  const [updateDonePieces] = useUpdateDonePiecesMutation()

  // Группы, чья массовая отметка ушла в кеш, но ещё не подтверждена сервером
  // (или её ошибка ещё не резинкнута). Set, а не одно значение — общий 500мс
  // дебаунс может успеть накопить клики по нескольким группам до flush.
  const [pendingGroupIds, setPendingGroupIds] = useState<ReadonlySet<string>>(new Set())

  // "Последние известные" аргументы запроса — читаются в cleanup-эффекте ниже
  // и в flush(), где обычные замыкания на момент клика уже устарели бы при
  // смене установки/версии набора.
  const sessionArgsRef = useRef(sessionArgs)
  useEffect(() => {
    sessionArgsRef.current = sessionArgs
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const args = sessionArgsRef.current
    if (args === skipToken) {
      setPendingGroupIds(new Set())
      return
    }
    const current = cuttingSessionApi.endpoints.getActiveCuttingSession.select(args)(store.getState()).data
    if (!current) {
      setPendingGroupIds(new Set())
      return
    }
    // Один запрос забирает весь накопленный прогресс (одиночные тогглы и
    // групповые отметки вместе). pendingGroupIds чистится целиком по
    // завершении — успех подтверждает всё, ошибку уже резинкает
    // onQueryStarted в updateDonePieces через инвалидацию тега.
    updateDonePieces({ sessionId: current.id, donePieces: current.donePieces })
      .unwrap()
      .catch(() => {})
      .finally(() => setPendingGroupIds(new Set()))
  }, [store, updateDonePieces])

  // Досылаем недописанный прогресс при смене установки/версии набора и при
  // уходе со страницы — не ждём таймер.
  useEffect(() => {
    return () => flush()
  }, [unitId, setId, unitNo, user?.id, flush])

  const toggle = useCallback(
    (groupPieceId: string) => {
      const args = sessionArgsRef.current
      if (args === skipToken) return
      // Отметка "щёлкает" мгновенно — патчим кеш RTK Query, не дожидаясь сети.
      dispatch(
        cuttingSessionApi.util.updateQueryData('getActiveCuttingSession', args, (draft) => {
          draft.donePieces = applyToggle(draft.donePieces, groupPieceId)
        }),
      )
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, FLUSH_DELAY_MS)
    },
    [dispatch, flush],
  )

  const setGroupDone = useCallback(
    (groupId: string, groupPieceIds: string[], done: boolean) => {
      const args = sessionArgsRef.current
      if (args === skipToken) return
      dispatch(
        cuttingSessionApi.util.updateQueryData('getActiveCuttingSession', args, (draft) => {
          draft.donePieces = applyBulk(draft.donePieces, groupPieceIds, done)
        }),
      )
      setPendingGroupIds((prev) => new Set(prev).add(groupId))
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, FLUSH_DELAY_MS)
    },
    [dispatch, flush],
  )

  const isPieceDone = useCallback(
    (groupPieceId: string) => Boolean(session?.donePieces[groupPieceId]),
    [session],
  )

  return { isPieceDone, toggle, setGroupDone, pendingGroupIds, isLoading }
}
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm typecheck`
Expected: без ошибок. (`InsulationPage` пока не использует новые поля — это нормально, TS не требует использовать все свойства возвращаемого объекта. Подключение — Task 6.)

- [ ] **Step 3: Коммит**

```bash
git add src/features/insulation-progress/model/useInsulationProgress.ts
git commit -m "Добавь setGroupDone и pendingGroupIds в useInsulationProgress"
```

---

### Task 4: Иконка `mark-all` и кнопки в `InsulationGroupItem`

**Files:**
- Create: `src/shared/assets/icons/mark-all.svg`
- Modify: `src/widgets/insulation-group-list/ui/InsulationGroupItem.tsx`
- Modify: `src/widgets/insulation-group-list/ui/InsulationGroupItem.module.scss`

**Interfaces:**
- Consumes: `IconButton` c `loading` из Task 2; `applyBulk`-эффект виден через пропсы `pendingGroupIds`/`onSetGroupDone`, форма которых зафиксирована в Task 3.
- Produces: `InsulationGroupItemProps` получает `pendingGroupIds: ReadonlySet<string>` и `onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void`. Используется в Task 5 (`InsulationGroupList`).

- [ ] **Step 1: Добавить иконку `mark-all.svg`**

Двойная галочка внахлёст — та же stroke-стилистика, что у `check.svg`/`close.svg` (viewBox 24×24, `stroke-width="2"`, `stroke-linecap="round"`).

```svg
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M1 12.5l4 4L13 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M8 12.5l4 4L23 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>
```

Сохранить в `src/shared/assets/icons/mark-all.svg`.

- [ ] **Step 2: Обновить `InsulationGroupItem`**

Полное содержимое `src/widgets/insulation-group-list/ui/InsulationGroupItem.tsx`:

```tsx
import { useEffect, useState } from 'react'
import * as Accordion from '@radix-ui/react-accordion'
import ChevronIcon from '@/shared/assets/icons/chevron.svg?react'
import CheckIcon from '@/shared/assets/icons/check.svg?react'
import CloseIcon from '@/shared/assets/icons/close.svg?react'
import MarkAllIcon from '@/shared/assets/icons/mark-all.svg?react'
import { IconButton } from '@/shared/ui'
import { useGetPiecesForGroupQuery } from '@/entities/insulation-piece'
import { InsulationPieceCard, summarizeByThickness } from '@/entities/insulation-piece'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { isGroupDone } from '@/features/insulation-progress'
import styles from './InsulationGroupItem.module.scss'

type PressedAction = 'markAll' | 'unmark' | null

interface InsulationGroupItemProps {
  group: InsulationGroupWithQuantity
  isPieceDone: (groupPieceId: string) => boolean
  onTogglePiece: (groupPieceId: string) => void
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
}

export const InsulationGroupItem = ({
  group,
  isPieceDone,
  onTogglePiece,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGroupItemProps) => {
  const { data: pieces = [], isLoading } = useGetPiecesForGroupQuery(group.id)
  const thicknessSummary = summarizeByThickness(pieces)
  // Чистое производное от индивидуальных отметок — отдельной логики "готова
  // ли группа" на сервере нет (docs/spec.md).
  const allDone = isGroupDone(
    pieces.map((piece) => piece.linkId),
    isPieceDone,
  )
  const hasAnyDone = pieces.some((piece) => isPieceDone(piece.linkId))
  const isPending = pendingGroupIds.has(group.linkId)

  // Какая из двух кнопок нажата последней — чтобы спиннер показывался
  // только на ней, а не на обеих сразу, пока обе disabled.
  const [pressedAction, setPressedAction] = useState<PressedAction>(null)
  useEffect(() => {
    if (!isPending) setPressedAction(null)
  }, [isPending])

  const handleMarkAll = () => {
    setPressedAction('markAll')
    onSetGroupDone(
      group.linkId,
      pieces.map((piece) => piece.linkId),
      true,
    )
  }

  const handleUnmark = () => {
    setPressedAction('unmark')
    onSetGroupDone(
      group.linkId,
      pieces.map((piece) => piece.linkId),
      false,
    )
  }

  return (
    <Accordion.Item value={group.linkId} className={styles.item}>
      <Accordion.Header className={styles.header}>
        <Accordion.Trigger className={styles.trigger}>
          <ChevronIcon className={styles.chevron} aria-hidden="true" />
          <span className={styles.name} title={group.name}>
            {group.name}
          </span>
          {allDone ? (
            <span className={styles.doneBadge}>
              <CheckIcon aria-hidden="true" />
              <span className={styles.visuallyHidden}>Группа готова</span>
            </span>
          ) : null}
          <span className={styles.count}>{pieces.length}</span>
        </Accordion.Trigger>
        {pieces.length === 0 || isLoading ? null : (
          <div className={styles.actions}>
            <IconButton
              icon={MarkAllIcon}
              label="Отметить всё готовым"
              loading={isPending && pressedAction === 'markAll'}
              disabled={allDone || isPending}
              onClick={handleMarkAll}
            />
            <IconButton
              icon={CloseIcon}
              label="Снять готовность"
              loading={isPending && pressedAction === 'unmark'}
              disabled={!hasAnyDone || isPending}
              onClick={handleUnmark}
            />
          </div>
        )}
      </Accordion.Header>
      <Accordion.Content className={styles.content}>
        {isLoading ? null : pieces.length === 0 ? (
          <p className={styles.empty}>В группе нет кусков</p>
        ) : (
          <div className={styles.grid}>
            {pieces.map((piece) => (
              <InsulationPieceCard
                key={piece.linkId}
                piece={piece}
                isDone={isPieceDone(piece.linkId)}
                onToggle={() => onTogglePiece(piece.linkId)}
              />
            ))}
          </div>
        )}
        {thicknessSummary.length > 0 ? (
          <ul className={styles.summary}>
            {thicknessSummary.map((entry) => (
              <li key={entry.thicknessMm} className={styles.summaryItem}>
                {entry.thicknessMm} мм — {entry.areaM2.toFixed(3)} м²
              </li>
            ))}
          </ul>
        ) : null}
      </Accordion.Content>
    </Accordion.Item>
  )
}
```

- [ ] **Step 3: Обновить стили — flex-строка шапки, эллипсис названия, блок кнопок**

Полное содержимое `src/widgets/insulation-group-list/ui/InsulationGroupItem.module.scss`:

```scss
.item {
  @include card-surface;

  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
}

.trigger {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex: 1;
  min-width: 0;
  padding: $space-3;

  @include touch-target;
  @include tap-feedback;

  color: $color-text;
  text-align: left;

  &:hover {
    background: $color-accent-cyan-muted;
  }

  &:focus-visible {
    @include focus-ring;
  }
}

.chevron {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: $color-text-muted;
  transition: transform $duration-fast $easing-standard;
}

.trigger[data-state='open'] .chevron {
  transform: rotate(180deg);
}

@include reduced-motion {
  .chevron {
    transition: none;
  }
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 0.9375rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  flex-shrink: 0;
  color: $color-text-muted;
  font-size: 0.8125rem;

  @include tabular-nums;
}

.actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: $space-1;
  padding-right: $space-2;
}

.content {
  padding: 0 $space-3 $space-3;
  border-top: 1px solid $color-border;
}

.empty {
  margin: $space-3 0;
  color: $color-text-muted;
  font-size: 0.875rem;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: $space-3;
  margin-top: $space-3;

  @include respond-to(tablet) {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}

.summary {
  display: flex;
  flex-wrap: wrap;
  gap: $space-1 $space-4;
  margin: $space-3 0 0;
  padding: $space-2 0 0;
  border-top: 1px solid $color-border;
  list-style: none;
  color: $color-text-muted;
  font-size: 0.8125rem;

  @include tabular-nums;
}

.doneBadge {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: $color-accent-cyan;
}

.visuallyHidden {
  @include visually-hidden;
}
```

- [ ] **Step 4: Проверить типы и линт**

Run: `pnpm typecheck && pnpm lint`
Expected: без ошибок. (Компонент временно без вызывающей стороны, обновлённой под новые пропсы — это чинится в Task 5; на этом шаге просто убеждаемся, что сам файл и стили валидны.)

- [ ] **Step 5: Коммит**

```bash
git add src/shared/assets/icons/mark-all.svg src/widgets/insulation-group-list/ui/InsulationGroupItem.tsx src/widgets/insulation-group-list/ui/InsulationGroupItem.module.scss
git commit -m "Добавь кнопки массовой отметки готовности в InsulationGroupItem"
```

---

### Task 5: Прокинуть пропсы через `InsulationGroupList`

**Files:**
- Modify: `src/widgets/insulation-group-list/ui/InsulationGroupList.tsx`

**Interfaces:**
- Consumes: `InsulationGroupItemProps.pendingGroupIds`/`onSetGroupDone` из Task 4.
- Produces: `InsulationGroupListProps` получает те же `pendingGroupIds`/`onSetGroupDone` — используется в Task 6 (`InsulationPage`).

- [ ] **Step 1: Прокинуть новые пропсы без изменения логики**

Полное содержимое `src/widgets/insulation-group-list/ui/InsulationGroupList.tsx`:

```tsx
import * as Accordion from '@radix-ui/react-accordion'
import { EmptyState } from '@/shared/ui'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { InsulationGroupItem } from './InsulationGroupItem'
import styles from './InsulationGroupList.module.scss'

interface InsulationGroupListProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
  isPieceDone: (groupPieceId: string) => boolean
  onTogglePiece: (groupPieceId: string) => void
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
}

// Все группы развёрнуты по умолчанию — сворачивание индивидуальное
// (docs/spec.md → "кнопка сворачивания группы (аккордеон)").
export const InsulationGroupList = ({
  groups,
  isLoading,
  isPieceDone,
  onTogglePiece,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGroupListProps) => {
  const defaultValue = groups.map((group) => group.linkId)

  if (isLoading) {
    return null
  }

  if (groups.length === 0) {
    return <EmptyState message="У набора нет групп изоляции" />
  }

  return (
    <Accordion.Root type="multiple" defaultValue={defaultValue} className={styles.list}>
      {groups.map((group) => (
        <InsulationGroupItem
          key={group.linkId}
          group={group}
          isPieceDone={isPieceDone}
          onTogglePiece={onTogglePiece}
          pendingGroupIds={pendingGroupIds}
          onSetGroupDone={onSetGroupDone}
        />
      ))}
    </Accordion.Root>
  )
}
```

- [ ] **Step 2: Проверить типы**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 3: Коммит**

```bash
git add src/widgets/insulation-group-list/ui/InsulationGroupList.tsx
git commit -m "Прокинь pendingGroupIds и onSetGroupDone через InsulationGroupList"
```

---

### Task 6: Подключить в `InsulationPage` и сквозная проверка

**Files:**
- Modify: `src/pages/insulation/ui/InsulationPage.tsx`

**Interfaces:**
- Consumes: `setGroupDone`/`pendingGroupIds` из `useInsulationProgress` (Task 3), `InsulationGroupListProps.pendingGroupIds`/`onSetGroupDone` из Task 5.

- [ ] **Step 1: Взять `setGroupDone`/`pendingGroupIds` из хука и прокинуть вниз**

Полное содержимое `src/pages/insulation/ui/InsulationPage.tsx`:

```tsx
import { skipToken } from '@reduxjs/toolkit/query/react'
import { useInsulationSetFilter, InsulationFilterBar } from '@/features/insulation-set-filter'
import { useInsulationProgress } from '@/features/insulation-progress'
import { useGetGroupsForSetQuery } from '@/entities/insulation-group'
import { InsulationGroupList } from '@/widgets/insulation-group-list'
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
        // key — при смене версии набора список групп (и их linkId, по которым
        // Accordion помнит развёрнутые пункты) полностью меняется; без key
        // React переиспользовал бы тот же компонент, и всё оказывалось бы
        // свёрнутым, т.к. старые linkId не совпадают с новыми.
        <InsulationGroupList
          key={selectedSetId}
          groups={groups}
          isLoading={isFetching}
          isPieceDone={isPieceDone}
          onTogglePiece={toggle}
          pendingGroupIds={pendingGroupIds}
          onSetGroupDone={setGroupDone}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Полная проверка**

Run: `pnpm check`
Expected: PASS (typecheck + lint + все юнит-тесты, включая новые `applyBulk`).

- [ ] **Step 3: Ручная проверка через `pnpm dev`**

Открыть страницу «Изоляция и раскрой», выбрать установку с набором изоляции, и по очереди проверить:

1. **Скрытие кнопок** — группа без кусков или ещё загружающаяся (`isLoading`) не показывает кнопки в шапке.
2. **Disabled-логика по отдельности** — в группе без единой отметки «Снять готовность» неактивна, «Отметить всё» активна; отметить один кусок вручную — «Снять готовность» становится активной; отметить все куски вручную — «Отметить всё» становится неактивной.
3. **Клик «Отметить всё готовым»** — все куски группы мгновенно помечаются готовыми (карточки кусков), бейдж-галочка в шапке группы появляется, обе кнопки группы временно `disabled`, на нажатой кнопке — спиннер (700мс вращение), на второй — просто серая disabled без спиннера. Через ~500мс+сеть спиннер пропадает, кнопки возвращаются в обычное состояние.
4. **Клик «Снять готовность»** — аналогично, все куски группы становятся неотмеченными, бейдж пропадает.
5. **Параллельные группы** — быстро (в пределах 500мс) кликнуть кнопку в одной группе, потом в другой: обе показывают спиннер/disabled до общего flush, не "теряют" индикатор раньше времени.
6. **Эллипсис названия** — группа с длинным названием: текст обрезается многоточием и не переносит кнопки на второй ряд; при наведении (десктоп) — нативный тултip с полным названием (`title`). Проверить и на узком вьюпорте (мобильная эмуляция в devtools).
7. **Клавиатура** — Tab доходит до обеих кнопок, Enter/Space активируют их, фокус-кольцо видно.
8. **Ошибка записи** — временно отключить сеть/PocketBase, кликнуть «Отметить всё», дождаться неудачного flush: кнопки не остаются бессрочно disabled/со спиннером — состояние резинкается с сервера и разблокируется.

- [ ] **Step 4: Коммит**

```bash
git add src/pages/insulation/ui/InsulationPage.tsx
git commit -m "Подключи групповую отметку готовности изоляции на странице"
```

---

## Self-Review

**Spec coverage:**
- `applyBulk` — Task 1. ✅
- Уточнённая сигнатура `setGroupDone(groupId, groupPieceIds, done)` с `group.linkId` — Task 3. ✅
- `pendingGroupIds: ReadonlySet<string>` через `useState`, общий таймер с `toggle` — Task 3. ✅
- `flush` очищает `pendingGroupIds` целиком по завершении (успех/ошибка) — Task 3. ✅
- Новые пропсы `InsulationGroupItem`, кнопки как соседний элемент `Trigger` внутри `Header`, скрытие при пустой/загружающейся группе, disabled-логика, спиннер только на нажатой кнопке, эллипсис + `title` — Task 4. ✅
- Новая иконка `mark-all.svg`, переиспользование `close.svg`/`check.svg` — Task 4. ✅
- Прокидывание пропсов через `InsulationGroupList`/`InsulationPage` без изменения логики — Task 5, Task 6. ✅
- Обработка ошибок — без изменений в `entities/cutting-session`, `pendingGroupIds` корректно очищается при ошибке — Task 3 (`.catch(() => {})` + `.finally`), проверено вручную в Task 6 Step 3.8. ✅
- Тестирование: `applyBulk` юнит-тесты по TDD (Task 1), ручная проверка остального (Task 6 Step 3), `pnpm check` перед коммитом (каждая задача). ✅

**Placeholder scan:** нет `TBD`/`TODO`/недописанных шагов — все шаги содержат полный код.

**Type consistency:** `setGroupDone`/`onSetGroupDone` — везде `(groupId: string, groupPieceIds: string[], done: boolean) => void` (Task 3, 4, 5, 6). `pendingGroupIds` — везде `ReadonlySet<string>` (Task 3, 4, 5, 6). `applyBulk` — сигнатура из Task 1 совпадает с использованием в Task 3.
