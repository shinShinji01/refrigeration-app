# Insulation list view controls + stats layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapse/expand-all toggle for insulation groups, a "detailed card" flag, a cross-group "by thickness" view, and rework the stats block layout/content on the `/insulation` page.

**Architecture:** Extends `widgets/insulation-group-list` with a toolbar (tabs + collapse toggle + detail checkbox) and a new flat by-thickness view, both driven by a new `useInsulationGroupList` hook (local state for open groups, `localStorage`-backed state for view/detail via a new generic `useLocalStorageState` hook). `entities/insulation-piece` gains a `groupId` field on its join type and a pure `groupByThickness` grouping function. `widgets/insulation-stats` swaps its bar chart for a text list and switches to a two-column layout on desktop. `pages/insulation` reorders its widgets.

**Tech Stack:** React 19 + TypeScript strict, Redux Toolkit Query, `@radix-ui/react-accordion` (existing) + `@radix-ui/react-tabs` (new), SASS modules, Vitest.

## Global Constraints

- Full spec: `docs/superpowers/specs/2026-08-10-insulation-view-controls-design.md` — read it before starting, this plan implements it task-by-task.
- No PocketBase schema/migration changes — `groupId` is a frontend-only extension of an already-joined TS type (`InsulationPieceWithQuantity`), populated from data already returned by existing queries.
- One new dependency: `@radix-ui/react-tabs` — approved as part of this spec (same family as the already-used `@radix-ui/react-accordion`/`@radix-ui/react-checkbox`/`@radix-ui/react-dialog`). Must be added to `docs/decisions.md` § 7 in the same commit that introduces it.
- Commit messages in English, imperative mood (project convention override of `CLAUDE.md`'s "Russian commit messages" — see `docs/decisions.md`/prior increments).
- Work happens on branch `feature/insulation-view-controls`, created from `master` before Task 1.
- Run `pnpm check` (typecheck + lint + test) at the end of every task — the repo must stay green after each one, not just at the end of the plan.
- No `any` — unknown types get narrowed. Id types stay branded (`InsulationGroupId`, `InsulationPieceId`).
- Only pure/reducer logic gets automated tests (matches existing project convention — there is no RTL/MSW test infrastructure yet, despite the packages being installed). UI is verified manually via `pnpm dev`.
- Colors/spacing/radii — only via SCSS tokens, no hardcoded hex. Media queries only via `@include respond-to(tablet)` (mobile-first, `min-width`). Max 3 levels of SCSS nesting.

---

### Task 1: `shared/lib/hooks` — `useLocalStorageState`

**Files:**
- Create: `src/shared/lib/hooks/useLocalStorageState.ts`
- Modify: `src/shared/lib/hooks/index.ts`

**Interfaces:**
- Produces: `useLocalStorageState<T>(key: string, initial: T): [T, (value: T) => void]`.

- [ ] **Step 1: Write `useLocalStorageState.ts`**

```ts
import { useState } from 'react'

// Настройки отображения списка изоляции (widgets/insulation-group-list),
// которые должны переживать перезагрузку страницы (docs/superpowers/specs/
// 2026-08-10-insulation-view-controls-design.md). Обычный useState +
// синхронизация с Web Storage API — без Redux, масштаб не тот (пара
// примитивных полей, не серверные и не доменные данные).
export const useLocalStorageState = <T,>(key: string, initial: T): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored === null ? initial : (JSON.parse(stored) as T)
    } catch {
      return initial
    }
  })

  const setPersisted = (next: T) => {
    setValue(next)
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // localStorage недоступен (приватный режим, квота) — в памяти всё равно обновилось
    }
  }

  return [value, setPersisted]
}
```

- [ ] **Step 2: Export from `shared/lib/hooks/index.ts`**

```ts
export { useMediaQuery } from './useMediaQuery'
export { useOnClickOutside } from './useOnClickOutside'
export { useDebounce } from './useDebounce'
export { useLocalStorageState } from './useLocalStorageState'
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: PASS (nothing consumes the hook yet — this only needs to compile and lint clean). No automated test for this hook — it's a thin wrapper over the Web Storage API (see Global Constraints).

- [ ] **Step 4: Commit**

```bash
git add src/shared/lib/hooks
git commit -m "Add useLocalStorageState hook"
```

---

### Task 2: `entities/insulation-piece` — `groupId` field + `groupByThickness`

**Files:**
- Modify: `src/entities/insulation-piece/model/types.ts`
- Modify: `src/entities/insulation-piece/api/insulationPieceApi.ts`
- Create: `src/entities/insulation-piece/lib/groupByThickness.ts`
- Create: `src/entities/insulation-piece/lib/groupByThickness.test.ts`
- Modify: `src/entities/insulation-piece/index.ts`

**Interfaces:**
- Produces: `InsulationPieceWithQuantity.groupId: InsulationGroupId`; `groupByThickness(pieces: InsulationPieceWithQuantity[]): ThicknessGroup[]` where `ThicknessGroup = { thicknessMm: number; pieces: InsulationPieceWithQuantity[] }`, sorted ascending by `thicknessMm`, pieces within a section keep their original relative order.

- [ ] **Step 1: Add `groupId` to `InsulationPieceWithQuantity`**

In `src/entities/insulation-piece/model/types.ts`, add the import and extend the type:

```ts
import type { BaseRecord } from '@/shared/api'
import type { Geometry } from '@/shared/lib/geometry'
import type { InsulationGroupId } from '@/entities/insulation-group'
```

```ts
// Кусок в составе конкретной группы (group_pieces) — с количеством и порядком
// показа. linkId — id join-записи; в docs/data-model.md это же значение служит
// ключом в donePieces сессии нарезки (Record<groupPieceId, true>). groupId —
// та же join-запись, но нужен для сквозного вида "по толщине"
// (widgets/insulation-group-list/ui/InsulationThicknessList), где кусок
// показывается вне своей группы и нужна ненавязчивая метка, откуда он.
export type InsulationPieceWithQuantity = InsulationPiece & {
  quantity: number
  order: number
  linkId: string
  groupId: InsulationGroupId
}
```

- [ ] **Step 2: Populate `groupId` in `toPiecesWithQuantity`**

In `src/entities/insulation-piece/api/insulationPieceApi.ts`, `InsulationGroupId` is already imported (used elsewhere in the file). Update the mapping:

```ts
const toPiecesWithQuantity = (links: GroupPieceRecord[]): InsulationPieceWithQuantity[] =>
  links
    .filter((link) => link.expand?.piece)
    .map((link) => ({
      ...withDrawingNumbers(link.expand!.piece),
      quantity: link.quantity,
      order: link.order,
      linkId: link.id,
      groupId: link.group as InsulationGroupId,
    }))
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Write the failing test for `groupByThickness`**

```ts
import { describe, expect, it } from 'vitest'
import { groupByThickness } from './groupByThickness'
import type { InsulationPieceWithQuantity } from '../model/types'

const piece = (linkId: string, thicknessMm: number): InsulationPieceWithQuantity =>
  ({ linkId, thicknessMm }) as InsulationPieceWithQuantity

describe('groupByThickness', () => {
  it('группирует куски по толщине, сохраняя порядок внутри группы', () => {
    const result = groupByThickness([piece('a', 13), piece('b', 6), piece('c', 13)])
    expect(result).toEqual([
      { thicknessMm: 6, pieces: [piece('b', 6)] },
      { thicknessMm: 13, pieces: [piece('a', 13), piece('c', 13)] },
    ])
  })

  it('сортирует секции по возрастанию толщины', () => {
    const result = groupByThickness([piece('a', 40), piece('b', 6), piece('c', 20)])
    expect(result.map((section) => section.thicknessMm)).toEqual([6, 20, 40])
  })

  it('пустой список — пустой результат', () => {
    expect(groupByThickness([])).toEqual([])
  })
})
```

Save this as `src/entities/insulation-piece/lib/groupByThickness.test.ts`.

- [ ] **Step 5: Run test to verify it fails**

Run: `pnpm test groupByThickness`
Expected: FAIL — `groupByThickness` module not found.

- [ ] **Step 6: Implement `groupByThickness.ts`**

```ts
import type { InsulationPieceWithQuantity } from '../model/types'

export interface ThicknessGroup {
  thicknessMm: number
  pieces: InsulationPieceWithQuantity[]
}

// Сквозной вид "по толщине" (widgets/insulation-group-list/ui/
// InsulationThicknessList) — куски всего набора, сгруппированные по толщине
// независимо от групп теплоизоляции, для удобства физической нарезки одной
// пачкой (docs/superpowers/specs/2026-08-10-insulation-view-controls-design.md).
export const groupByThickness = (pieces: InsulationPieceWithQuantity[]): ThicknessGroup[] => {
  const byThickness = new Map<number, InsulationPieceWithQuantity[]>()

  for (const piece of pieces) {
    const group = byThickness.get(piece.thicknessMm)
    if (group) {
      group.push(piece)
    } else {
      byThickness.set(piece.thicknessMm, [piece])
    }
  }

  return [...byThickness.entries()]
    .map(([thicknessMm, groupedPieces]) => ({ thicknessMm, pieces: groupedPieces }))
    .sort((a, b) => a.thicknessMm - b.thicknessMm)
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm test groupByThickness`
Expected: PASS (3 tests).

- [ ] **Step 8: Re-export from `entities/insulation-piece/index.ts`**

```ts
export type { InsulationPieceId, InsulationPiece, InsulationPieceWithQuantity } from './model/types'
export { useGetPiecesForGroupQuery, useGetPiecesForGroupsQuery, useGetInsulationSetStatsQuery } from './api/insulationPieceApi'
export type { InsulationSetStats } from './api/insulationPieceApi'
export { summarizeByThickness } from './lib/summarizeByThickness'
export type { ThicknessSummary } from './lib/summarizeByThickness'
export { summarizeByGroup } from './lib/summarizeByGroup'
export type { GroupAreaSummary } from './lib/summarizeByGroup'
export { groupByThickness } from './lib/groupByThickness'
export type { ThicknessGroup } from './lib/groupByThickness'
export { InsulationPieceCard } from './ui/InsulationPieceCard'
```

- [ ] **Step 9: Full verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/entities/insulation-piece
git commit -m "Add groupId to InsulationPieceWithQuantity and groupByThickness helper"
```

---

### Task 3: `InsulationPieceCard` — `detailed` / `groupLabel` props

**Files:**
- Modify: `src/entities/insulation-piece/ui/InsulationPieceCard.tsx`
- Modify: `src/entities/insulation-piece/ui/InsulationPieceCard.module.scss`

**Interfaces:**
- Consumes: nothing new.
- Produces: `InsulationPieceCardProps` gains `detailed?: boolean` (default `true`) and `groupLabel?: string`. No existing caller (`InsulationGroupItem`) needs to change in this task — the default preserves current behavior exactly.

- [ ] **Step 1: Update `InsulationPieceCard.tsx`**

Replace the full file contents:

```tsx
import type { CSSProperties, KeyboardEvent } from 'react'
import clsx from 'clsx'
import TypeInsulationIcon from '@/shared/assets/icons/type-insulation.svg?react'
import CheckIcon from '@/shared/assets/icons/check.svg?react'
import { formatArea } from '@/shared/lib/utils'
import type { InsulationPieceWithQuantity } from '../model/types'
import styles from './InsulationPieceCard.module.scss'

interface InsulationPieceCardProps {
  piece: InsulationPieceWithQuantity
  isDone: boolean
  onToggle: () => void
  // Флажок "Подробная информация" (widgets/insulation-group-list) — при false
  // скрывает номер чертежа, площадь и отметку клеевого слоя, оставляя только
  // название/размер/толщину. Default true — совпадает с поведением карточки
  // до появления флажка (docs/superpowers/specs/2026-08-10-...).
  detailed?: boolean
  // Метка исходной группы куска — используется только в сквозном виде "по
  // толщине" (InsulationThicknessList), где куски показаны вне группового
  // аккордеона. Видна независимо от detailed — навигационная метка, не деталь.
  groupLabel?: string
}

// Пока не цвет ComponentCard-типов (docs/CLAUDE.md → cyan/янтарный/красный —
// зарезервированы под состояния) — кусок изоляции не относится к трём типам
// установка/узел/деталь, поэтому свой акцент. Готовность (isDone) всё равно
// использует общий cyan-акцент состояния, перекрывая --accent.
const ACCENT = '#4a7a96'

const formatDimensions = (piece: InsulationPieceWithQuantity): string =>
  piece.geometry.kind === 'rect' ? `${piece.geometry.width} × ${piece.geometry.height} мм` : 'Многоугольник'

export const InsulationPieceCard = ({
  piece,
  isDone,
  onToggle,
  detailed = true,
  groupLabel,
}: InsulationPieceCardProps) => {
  const style: CSSProperties & { '--accent': string } = { '--accent': ACCENT }
  const subtitle = piece.drawingNumbers.length > 0 ? piece.drawingNumbers.join(', ') : piece.id
  const title = piece.quantity > 1 ? `${piece.name} × ${piece.quantity}` : piece.name

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <article
      className={clsx(styles.root, piece.isArchived && styles.archived, isDone && styles.done)}
      style={style}
      role="button"
      tabIndex={0}
      aria-pressed={isDone}
      aria-label={`${title}${isDone ? ', готово' : ', отметить готовым'}`}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <TypeInsulationIcon className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        {groupLabel ? <span className={styles.groupLabel}>{groupLabel}</span> : null}
        <h4 className={styles.title}>{title}</h4>
        {detailed ? <p className={styles.subtitle}>{subtitle}</p> : null}
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Размер</dt>
            <dd>{formatDimensions(piece)}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Толщина</dt>
            <dd>{piece.thicknessMm} мм</dd>
          </div>
          {detailed ? (
            <div className={styles.stat}>
              <dt>Площадь</dt>
              <dd>{formatArea(piece.areaMm2)}</dd>
            </div>
          ) : null}
        </dl>
        {detailed && piece.hasAdhesive ? <span className={styles.adhesive}>Клеевой слой</span> : null}
      </div>
      {isDone ? <CheckIcon className={styles.doneIcon} aria-hidden="true" /> : null}
    </article>
  )
}
```

- [ ] **Step 2: Add `.groupLabel` style**

Append to `InsulationPieceCard.module.scss`:

```scss
.groupLabel {
  display: block;
  margin-bottom: 2px;
  color: $color-text-muted;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Manual sanity check** (`pnpm dev`)

Open `/insulation` — cards render exactly as before (default `detailed=true`, no `groupLabel` passed anywhere yet).

- [ ] **Step 5: Commit**

```bash
git add src/entities/insulation-piece/ui
git commit -m "Add detailed and groupLabel props to InsulationPieceCard"
```

---

### Task 4: `widgets/insulation-group-list` — `useInsulationGroupList` hook

**Files:**
- Create: `src/widgets/insulation-group-list/model/useInsulationGroupList.ts`

**Interfaces:**
- Consumes: `useLocalStorageState` (Task 1), `InsulationGroupWithQuantity` (`@/entities/insulation-group`).
- Produces: `useInsulationGroupList(groups: InsulationGroupWithQuantity[])` returning `{ openGroupIds: string[]; onOpenGroupIdsChange: (ids: string[]) => void; areAllGroupsOpen: boolean; toggleAllGroups: () => void; activeView: InsulationListView; setActiveView: (view: InsulationListView) => void; detailed: boolean; setDetailed: (detailed: boolean) => void }`. `InsulationListView = 'byGroup' | 'byThickness'`.

- [ ] **Step 1: Write `useInsulationGroupList.ts`**

```ts
import { useState } from 'react'
import { useLocalStorageState } from '@/shared/lib/hooks'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'

export type InsulationListView = 'byGroup' | 'byThickness'

// Открытые группы аккордеона — обычный локальный стейт, НЕ персистится
// (docs/superpowers/specs/2026-08-10-...: персистятся только вид и флажок
// детализации). При смене набора InsulationGroupList пересоздаётся через
// key={selectedSetId} в InsulationPage, так что "все группы развёрнуты по
// умолчанию" сохраняется без явного сброса при смене версии. Сброс именно
// ПРИ смене состава groups в рамках одного монтирования (первая загрузка
// данных) — через паттерн "adjusting state when a prop changes" (тот же
// приём, что prevIsPending в InsulationGroupItem).
export const useInsulationGroupList = (groups: InsulationGroupWithQuantity[]) => {
  const groupLinkIds = groups.map((group) => group.linkId)
  const groupLinkIdsKey = groupLinkIds.join(',')

  const [openGroupIds, setOpenGroupIds] = useState<string[]>(groupLinkIds)
  const [prevGroupLinkIdsKey, setPrevGroupLinkIdsKey] = useState(groupLinkIdsKey)
  if (groupLinkIdsKey !== prevGroupLinkIdsKey) {
    setPrevGroupLinkIdsKey(groupLinkIdsKey)
    setOpenGroupIds(groupLinkIds)
  }

  const areAllGroupsOpen = groupLinkIds.length > 0 && openGroupIds.length === groupLinkIds.length
  const toggleAllGroups = () => setOpenGroupIds(areAllGroupsOpen ? [] : groupLinkIds)

  const [activeView, setActiveView] = useLocalStorageState<InsulationListView>('insulation.view', 'byGroup')
  const [detailed, setDetailed] = useLocalStorageState<boolean>('insulation.detailedCards', true)

  return {
    openGroupIds,
    onOpenGroupIdsChange: setOpenGroupIds,
    areAllGroupsOpen,
    toggleAllGroups,
    activeView,
    setActiveView,
    detailed,
    setDetailed,
  }
}
```

- [ ] **Step 2: Verify**

Run: `pnpm check`
Expected: PASS (nothing consumes the hook yet).

- [ ] **Step 3: Commit**

```bash
git add src/widgets/insulation-group-list/model/useInsulationGroupList.ts
git commit -m "Add useInsulationGroupList hook"
```

---

### Task 5: `@radix-ui/react-tabs` dependency + `InsulationListToolbar`

**Files:**
- Modify: `package.json` / `pnpm-lock.yaml` (via `pnpm add`)
- Modify: `docs/decisions.md`
- Create: `src/widgets/insulation-group-list/ui/InsulationListToolbar.tsx`
- Create: `src/widgets/insulation-group-list/ui/InsulationListToolbar.module.scss`

**Interfaces:**
- Consumes: `InsulationListView` (Task 4), `Checkbox` (`@/shared/ui`), `Tabs` from `@radix-ui/react-tabs`.
- Produces: `<InsulationListToolbar activeView areAllGroupsOpen onToggleAllGroups detailed onDetailedChange />` — zero domain logic, pure presentational widget.

- [ ] **Step 1: Add the dependency**

Run: `pnpm add @radix-ui/react-tabs`

- [ ] **Step 2: Record it in `docs/decisions.md`**

In `docs/decisions.md` § 7 "Утверждённые зависимости", under "UI-примитивы", after the `@radix-ui/react-checkbox` line, add:

```
`@radix-ui/react-tabs` — переключатель вида списка изоляции (по группам / по толщине)
```

- [ ] **Step 3: Write `InsulationListToolbar.tsx`**

```tsx
import * as Tabs from '@radix-ui/react-tabs'
import { Checkbox } from '@/shared/ui'
import type { InsulationListView } from '../model/useInsulationGroupList'
import styles from './InsulationListToolbar.module.scss'

interface InsulationListToolbarProps {
  activeView: InsulationListView
  areAllGroupsOpen: boolean
  onToggleAllGroups: () => void
  detailed: boolean
  onDetailedChange: (detailed: boolean) => void
}

// Панель управления списком кусков изоляции: таб-переключатель вида,
// тумблер свернуть/развернуть все группы (только для вида "по группам") и
// флажок подробной информации на карточках (docs/superpowers/specs/
// 2026-08-10-insulation-view-controls-design.md). Tabs.List/Trigger должны
// рендериться внутри Tabs.Root — это обеспечивает родитель
// (InsulationGroupList), сюда компонент попадает как обычный child.
export const InsulationListToolbar = ({
  activeView,
  areAllGroupsOpen,
  onToggleAllGroups,
  detailed,
  onDetailedChange,
}: InsulationListToolbarProps) => (
  <div className={styles.root}>
    <Tabs.List className={styles.tabs}>
      <Tabs.Trigger value="byGroup" className={styles.tab}>
        По группам
      </Tabs.Trigger>
      <Tabs.Trigger value="byThickness" className={styles.tab}>
        По толщине
      </Tabs.Trigger>
    </Tabs.List>
    {activeView === 'byGroup' ? (
      <button type="button" className={styles.collapseToggle} onClick={onToggleAllGroups}>
        {areAllGroupsOpen ? 'Свернуть все' : 'Развернуть все'}
      </button>
    ) : null}
    <Checkbox
      id="insulation-detailed-cards"
      checked={detailed}
      onCheckedChange={onDetailedChange}
      label="Подробная информация"
    />
  </div>
)
```

- [ ] **Step 4: Write `InsulationListToolbar.module.scss`**

```scss
.root {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $space-3;
}

.tabs {
  display: flex;
  gap: $space-1;
}

.tab {
  padding: 0 $space-3;
  min-height: 36px;
  color: $color-text-muted;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  font-size: 0.8125rem;
  font-weight: 600;

  @include tap-feedback;

  &:focus-visible {
    @include focus-ring;
  }

  &[data-state='active'] {
    color: $color-accent-cyan;
    background: $color-accent-cyan-muted;
    border-color: $color-accent-cyan;
  }
}

.collapseToggle {
  padding: 0 $space-3;

  @include touch-target;
  @include tap-feedback;

  color: $color-text;
  background: $color-bg;
  border: 1px solid $color-border;
  border-radius: $radius-sm;
  font-size: 0.8125rem;
  font-weight: 600;

  &:focus-visible {
    @include focus-ring;
  }
}
```

- [ ] **Step 5: Verify**

Run: `pnpm check`
Expected: PASS. Nothing mounts `InsulationListToolbar` yet.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml docs/decisions.md src/widgets/insulation-group-list/ui/InsulationListToolbar.tsx src/widgets/insulation-group-list/ui/InsulationListToolbar.module.scss
git commit -m "Add @radix-ui/react-tabs and InsulationListToolbar"
```

---

### Task 6: `InsulationThicknessList`

**Files:**
- Create: `src/widgets/insulation-group-list/ui/InsulationThicknessList.tsx`
- Create: `src/widgets/insulation-group-list/ui/InsulationThicknessList.module.scss`

**Interfaces:**
- Consumes: `useGetPiecesForGroupsQuery`, `groupByThickness`, `InsulationPieceCard` (all `@/entities/insulation-piece`, Task 2/3), `InsulationGroupWithQuantity`/`InsulationGroupId` (`@/entities/insulation-group`).
- Produces: `<InsulationThicknessList groups detailed isPieceDone onTogglePiece />`.

- [ ] **Step 1: Write `InsulationThicknessList.tsx`**

```tsx
import { skipToken } from '@reduxjs/toolkit/query/react'
import { EmptyState } from '@/shared/ui'
import type { InsulationGroupWithQuantity, InsulationGroupId } from '@/entities/insulation-group'
import { useGetPiecesForGroupsQuery, groupByThickness, InsulationPieceCard } from '@/entities/insulation-piece'
import styles from './InsulationThicknessList.module.scss'

interface InsulationThicknessListProps {
  groups: InsulationGroupWithQuantity[]
  detailed: boolean
  isPieceDone: (groupPieceId: string) => boolean
  onTogglePiece: (groupPieceId: string) => void
}

// Сквозной (вне групп) вид кусков изоляции набора, сгруппированных по
// толщине — для удобства физической нарезки одной пачкой
// (docs/superpowers/specs/2026-08-10-insulation-view-controls-design.md).
// Плоский список без сворачивания и без кнопок массовой отметки — это
// осталось только у групп (InsulationGroupItem).
export const InsulationThicknessList = ({
  groups,
  detailed,
  isPieceDone,
  onTogglePiece,
}: InsulationThicknessListProps) => {
  const groupIds = groups.map((group) => group.id)
  // currentData/isFetching — тот же паттерн защиты от гонки версий набора,
  // что в useInsulationGlobalActions/useInsulationStats: иначе на смене
  // версии currentData какое-то время отдаёт куски СТАРОЙ версии, пока
  // грузится новая (RTK Query отдаёт data от предыдущего arg).
  const { currentData: pieces = [], isFetching } = useGetPiecesForGroupsQuery(
    groupIds.length === 0 ? skipToken : groupIds,
  )
  const groupNameById = new Map<InsulationGroupId, string>(groups.map((group) => [group.id, group.name]))
  const sections = groupByThickness(pieces)

  if (isFetching) {
    return null
  }

  if (sections.length === 0) {
    return <EmptyState message="В наборе нет кусков" />
  }

  return (
    <div className={styles.root}>
      {sections.map((section) => (
        <section key={section.thicknessMm} className={styles.section}>
          <h3 className={styles.heading}>{section.thicknessMm} мм</h3>
          <div className={styles.grid}>
            {section.pieces.map((piece) => (
              <InsulationPieceCard
                key={piece.linkId}
                piece={piece}
                isDone={isPieceDone(piece.linkId)}
                onToggle={() => onTogglePiece(piece.linkId)}
                detailed={detailed}
                groupLabel={groupNameById.get(piece.groupId)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write `InsulationThicknessList.module.scss`**

```scss
.root {
  display: flex;
  flex-direction: column;
  gap: $space-4;
}

.section {
  display: flex;
  flex-direction: column;
  gap: $space-2;
}

.heading {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: $color-text;

  @include tabular-nums;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: $space-3;

  @include respond-to(tablet) {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: PASS. Nothing mounts `InsulationThicknessList` yet.

- [ ] **Step 4: Commit**

```bash
git add src/widgets/insulation-group-list/ui/InsulationThicknessList.tsx src/widgets/insulation-group-list/ui/InsulationThicknessList.module.scss
git commit -m "Add InsulationThicknessList"
```

---

### Task 7: Wire tabs, toolbar, thickness view and detailed flag into `InsulationGroupList`

**Files:**
- Modify: `src/widgets/insulation-group-list/ui/InsulationGroupList.tsx`
- Modify: `src/widgets/insulation-group-list/ui/InsulationGroupList.module.scss`
- Modify: `src/widgets/insulation-group-list/ui/InsulationGroupItem.tsx`

**Interfaces:**
- Consumes: `useInsulationGroupList` (Task 4), `InsulationListToolbar` (Task 5), `InsulationThicknessList` (Task 6).
- Produces: `InsulationGroupItemProps` gains a required `detailed: boolean`, forwarded to `InsulationPieceCard`.

- [ ] **Step 1: Update `InsulationGroupItem.tsx`**

Add `detailed: boolean` to the props interface and pass it through to the card. Modify the props interface:

```ts
interface InsulationGroupItemProps {
  group: InsulationGroupWithQuantity
  detailed: boolean
  isPieceDone: (groupPieceId: string) => boolean
  onTogglePiece: (groupPieceId: string) => void
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
}
```

Add `detailed` to the destructured props:

```ts
export const InsulationGroupItem = ({
  group,
  detailed,
  isPieceDone,
  onTogglePiece,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGroupItemProps) => {
```

Update the `InsulationPieceCard` call inside the `.grid` map to pass it:

```tsx
<InsulationPieceCard
  key={piece.linkId}
  piece={piece}
  isDone={isPieceDone(piece.linkId)}
  onToggle={() => onTogglePiece(piece.linkId)}
  detailed={detailed}
/>
```

- [ ] **Step 2: Replace `InsulationGroupList.tsx`**

```tsx
import * as Accordion from '@radix-ui/react-accordion'
import * as Tabs from '@radix-ui/react-tabs'
import { EmptyState } from '@/shared/ui'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { InsulationGroupItem } from './InsulationGroupItem'
import { InsulationListToolbar } from './InsulationListToolbar'
import { InsulationThicknessList } from './InsulationThicknessList'
import { useInsulationGroupList } from '../model/useInsulationGroupList'
import type { InsulationListView } from '../model/useInsulationGroupList'
import styles from './InsulationGroupList.module.scss'

interface InsulationGroupListProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
  isPieceDone: (groupPieceId: string) => boolean
  onTogglePiece: (groupPieceId: string) => void
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
}

const isInsulationListView = (value: string): value is InsulationListView =>
  value === 'byGroup' || value === 'byThickness'

// Два вида одного и того же набора кусков — по группам (аккордеон,
// сворачивание, кнопки массовой отметки — см. InsulationGroupItem) и по
// толщине (сквозной плоский список, InsulationThicknessList) — переключаются
// табами; вид и флажок подробной информации персистятся в localStorage через
// useInsulationGroupList (docs/superpowers/specs/2026-08-10-...).
export const InsulationGroupList = ({
  groups,
  isLoading,
  isPieceDone,
  onTogglePiece,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGroupListProps) => {
  const {
    openGroupIds,
    onOpenGroupIdsChange,
    areAllGroupsOpen,
    toggleAllGroups,
    activeView,
    setActiveView,
    detailed,
    setDetailed,
  } = useInsulationGroupList(groups)

  if (isLoading) {
    return null
  }

  if (groups.length === 0) {
    return <EmptyState message="У набора нет групп изоляции" />
  }

  return (
    <Tabs.Root
      className={styles.root}
      value={activeView}
      onValueChange={(value) => {
        if (isInsulationListView(value)) setActiveView(value)
      }}
    >
      <InsulationListToolbar
        activeView={activeView}
        areAllGroupsOpen={areAllGroupsOpen}
        onToggleAllGroups={toggleAllGroups}
        detailed={detailed}
        onDetailedChange={setDetailed}
      />
      <Tabs.Content value="byGroup">
        <Accordion.Root
          type="multiple"
          value={openGroupIds}
          onValueChange={onOpenGroupIdsChange}
          className={styles.list}
        >
          {groups.map((group) => (
            <InsulationGroupItem
              key={group.linkId}
              group={group}
              detailed={detailed}
              isPieceDone={isPieceDone}
              onTogglePiece={onTogglePiece}
              pendingGroupIds={pendingGroupIds}
              onSetGroupDone={onSetGroupDone}
            />
          ))}
        </Accordion.Root>
      </Tabs.Content>
      <Tabs.Content value="byThickness">
        <InsulationThicknessList
          groups={groups}
          detailed={detailed}
          isPieceDone={isPieceDone}
          onTogglePiece={onTogglePiece}
        />
      </Tabs.Content>
    </Tabs.Root>
  )
}
```

Note: Radix `Tabs.Content` only renders its children while `value` matches the active tab (no `forceMount`), so `InsulationThicknessList`'s query only fires once the user actually opens that tab — no wasted request on first page load.

- [ ] **Step 3: Update `InsulationGroupList.module.scss`**

Replace the full file contents:

```scss
.root {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.list {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}
```

- [ ] **Step 4: Verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 5: Manual verification** (`pnpm pb` + `pnpm dev`, on `/insulation`)

- Toolbar shows two tabs ("По группам" / "По толщине"), a collapse toggle (only on "По группам"), and the "Подробная информация" checkbox.
- "По группам": default all groups expanded → toggle reads "Свернуть все" → click collapses all, label flips to "Развернуть все" → manually expand one group via its own chevron → label reads "Развернуть все" (not all open) → click expands all again.
- "По толщине": switching tabs shows pieces grouped into ascending-thickness sections, each piece card shows a small muted group-name tag; toggling a piece's done state here and switching back to "По группам" shows the same state (same `isPieceDone`/`linkId`).
- Unchecking "Подробная информация" hides drawing number, area and adhesive badge on cards in both tabs; name/size/thickness remain.
- Reload the page: active tab and detail-checkbox state are restored from `localStorage`; open/closed groups reset to all-open (not persisted, matches spec).
- Keyboard pass: Tab through tab triggers, collapse toggle, checkbox — all reachable, visible focus ring.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/insulation-group-list
git commit -m "Wire tabs, collapse toggle and detailed flag into InsulationGroupList"
```

---

### Task 8: `InsulationStats` — text thickness list + desktop grid layout

**Files:**
- Modify: `src/widgets/insulation-stats/ui/InsulationStats.tsx`
- Modify: `src/widgets/insulation-stats/ui/InsulationStats.module.scss`

**Interfaces:**
- Consumes: `useInsulationStats` (unchanged).
- Produces: no external interface change — `InsulationStats` keeps the same `InsulationStatsProps`.

- [ ] **Step 1: Replace `InsulationStats.tsx`**

```tsx
import { useState } from 'react'
import { DonutChart, EmptyState } from '@/shared/ui'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { useInsulationStats } from '../model/useInsulationStats'
import styles from './InsulationStats.module.scss'

interface InsulationStatsProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
}

// Фиксированные 3 знака в м² — тот же формат, что уже использует подвал
// группы (InsulationGroupItem, summarizeByThickness), а не адаптивный
// shared/lib/utils/formatArea (тот подбирает см²/м² под площадь ОДНОГО
// куска и явно не предназначен для площади группы/набора — см. его
// комментарий).
const formatAreaM2 = (value: number) => `${value.toFixed(3)} м²`

export const InsulationStats = ({ groups, isLoading }: InsulationStatsProps) => {
  const { byGroup, byThickness, totalAreaM2, isLoading: statsLoading } = useInsulationStats(groups)
  const [donutActiveId, setDonutActiveId] = useState<string | null>(null)

  if (groups.length === 0) {
    return null
  }

  if (isLoading || statsLoading) {
    return null
  }

  if (totalAreaM2 === 0) {
    return <EmptyState message="Нет данных для статистики" />
  }

  return (
    <div className={styles.root}>
      <div className={styles.chart}>
        <DonutChart
          segments={byGroup.map((entry) => ({ id: entry.id, label: entry.label, value: entry.areaM2 }))}
          activeId={donutActiveId}
          onSegmentActivate={setDonutActiveId}
          valueFormatter={formatAreaM2}
          title="Площадь изоляции по группам"
        />
      </div>
      <ul className={styles.legend}>
        {byGroup.map((entry, index) => (
          <li key={entry.id}>
            <button
              type="button"
              className={styles.legendRow}
              aria-current={entry.id === donutActiveId}
              onClick={() => setDonutActiveId(entry.id === donutActiveId ? null : entry.id)}
            >
              <span className={styles.legendIndex}>{index + 1}</span>
              <span className={styles.legendName}>{entry.label}</span>
              <span className={styles.legendValue}>{formatAreaM2(entry.areaM2)}</span>
              <span className={styles.legendPercent}>{Math.round((entry.areaM2 / totalAreaM2) * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
      <ul className={styles.thicknessList}>
        {byThickness.map((entry) => (
          <li key={entry.thicknessMm} className={styles.thicknessItem}>
            {entry.thicknessMm} мм — {formatAreaM2(entry.areaM2)}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Replace `InsulationStats.module.scss`**

```scss
.root {
  @include card-surface;

  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-4;

  @include respond-to(tablet) {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas:
      'chart legend'
      'thickness thickness';
    align-items: start;
  }
}

.chart {
  @include respond-to(tablet) {
    grid-area: chart;
  }
}

.legend {
  display: flex;
  flex-direction: column;
  gap: $space-1;
  margin: 0;
  padding: 0;
  list-style: none;

  @include respond-to(tablet) {
    grid-area: legend;
  }
}

.legendRow {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  width: 100%;
  gap: $space-2;
  padding: $space-2;

  @include touch-target;
  @include tap-feedback;

  border: none;
  border-radius: $radius-sm;
  background: none;
  color: $color-text;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: $color-accent-cyan-muted;
  }

  &:focus-visible {
    @include focus-ring;
  }

  &[aria-current='true'] {
    background: $color-accent-cyan-muted;
    color: $color-accent-cyan;
  }
}

.legendIndex {
  color: $color-text-muted;
  font-size: 0.75rem;

  @include tabular-nums;
}

.legendName {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legendValue,
.legendPercent {
  color: $color-text-muted;
  font-size: 0.8125rem;

  @include tabular-nums;
}

.thicknessList {
  display: flex;
  flex-wrap: wrap;
  gap: $space-1 $space-4;
  margin: 0;
  padding-top: $space-3;
  border-top: 1px solid $color-border;
  list-style: none;
  color: $color-text-muted;
  font-size: 0.8125rem;

  @include tabular-nums;

  @include respond-to(tablet) {
    grid-area: thickness;
  }
}

.thicknessItem {
  white-space: nowrap;
}
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 4: Manual verification** (`pnpm dev`, on `/insulation`, scroll to the stats block)

- Mobile width: donut chart, then legend list, then thickness text list — stacked, as before.
- Tablet+ width: donut chart and legend sit side by side (legend to the right); thickness text list spans the full width below both.
- `BarChart` (`src/shared/ui/charts/BarChart.tsx`) still exists in the codebase and still exports cleanly — it's just no longer imported by `InsulationStats`.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/insulation-stats
git commit -m "Replace insulation thickness bar chart with text list and add desktop grid layout"
```

---

### Task 9: Reorder `InsulationPage` + full end-to-end manual pass

**Files:**
- Modify: `src/pages/insulation/ui/InsulationPage.tsx`

**Interfaces:**
- Consumes: `InsulationGroupList`, `InsulationGlobalActions`, `InsulationSaveSession`, `InsulationStats` (all unchanged imports, only render order changes).

- [ ] **Step 1: Reorder widgets in `InsulationPage.tsx`**

Change the render block from:

```tsx
<InsulationGroupList
  key={selectedSetId}
  groups={groups}
  isLoading={isFetching}
  isPieceDone={isPieceDone}
  onTogglePiece={toggle}
  pendingGroupIds={pendingGroupIds}
  onSetGroupDone={setGroupDone}
/>
<InsulationStats key={selectedSetId} groups={groups} isLoading={isFetching} />
<InsulationGlobalActions
  groups={groups}
  isLoading={isFetching}
  isPieceDone={isPieceDone}
  pendingGroupIds={pendingGroupIds}
  onSetGroupDone={setGroupDone}
/>
<InsulationSaveSession />
```

to:

```tsx
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
<InsulationSaveSession />
<InsulationStats key={selectedSetId} groups={groups} isLoading={isFetching} />
```

- [ ] **Step 2: Verify**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 3: Full manual end-to-end pass** (`pnpm pb` + `pnpm dev`, on `/insulation`)

Walk through all six original requests together:

1. Page order top to bottom: filter bar → group/thickness toolbar+list → global mark-all/unmark buttons → "Сохранить" button → stats block.
2. Collapse/expand-all toggle on "По группам" correctly reflects and controls all-open / partially-open / all-closed states.
3. "Подробная информация" checkbox toggles card detail on both tabs; state survives a page reload.
4. "По толщине" tab shows pieces grouped by thickness across all groups, each card tagged with its source group; toggling done-state here is reflected back on "По группам" for the same piece.
5. Stats block: donut chart + legend side-by-side on desktop, stacked on mobile; thickness breakdown is plain text, no bar chart.
6. `pnpm check` is green end to end.

- [ ] **Step 4: Commit**

```bash
git add src/pages/insulation/ui/InsulationPage.tsx
git commit -m "Move insulation stats block below global actions and save session"
```
