# Insulation cutting progress — per-unit tracking — Design

## Контекст

Страница `/insulation` уже отслеживает готовность нарезки на уровне строки
`group_pieces` — клик по карточке куска (`InsulationPieceCard`) переключает её
между «не готово» и «готово» одним булевым флагом
(`cutting_sessions.donePieces: Record<groupPieceId, true>`, см.
`docs/data-model.md`).

Строка `group_pieces` имеет поле `quantity` — один и тот же кусок в группе
может быть нужен в нескольких экземплярах (например, «Полка × 5»). Сейчас это
поле только отображается в заголовке карточки (`Название × quantity`), но
готовность у него одна на всю партию: нельзя отметить «отрезал 2 из 5 сегодня,
остальные 3 — завтра». Этот дизайн вводит частичный прогресс по количеству.

Инициировано пользователем в разговоре 2026-08-11 (после мержа
`docs/superpowers/specs/2026-08-10-insulation-view-controls-design.md`).
Ключевые решения по ходу брейншторма:

1. Нужен именно частичный прогресс внутри одной строки куска, а не просто
   информационный счётчик.
2. Управление — степпер: клик по самой карточке продвигает счётчик на 1;
   отдельная маленькая кнопка «−» на карточке уменьшает на 1.
3. Для `quantity <= 1` (подавляющее большинство кусков) карточка ведёт себя
   ровно как сейчас — один клик по всей карточке переключает 0 ↔ 1. Степпер
   не показывается вообще — не усложняем самый частый случай.
4. Клик по карточке, уже достигшей `quantity`, сбрасывает счётчик в 0 (тот же
   toggle-паттерн, что и сейчас у карточек с `quantity=1`, распространённый
   на многошаговый случай). Точечная коррекция на ±1 — через кнопку «−».
5. Отображение частичного прогресса — текст `«N / M»` табличными цифрами +
   приглушённая подложка акцентным цветом куска (без галочки — галочка
   остаётся только у полностью готового куска).
6. Хранение в БД — число вместо булева флага в том же JSON-поле
   `donePieces`, без миграции существующих данных.

## Архитектура

### Данные и API прогресса (`entities/cutting-session`, `features/insulation-progress`)

`cutting_sessions.donePieces` — поле в PocketBase остаётся `json` (схема не
меняется, `docs/data-model.md` только уточняет тип значения):

```ts
// было:  Record<groupPieceId, true>
// стало: Record<groupPieceId, number | true>
```

Новые записи всегда пишут число — сколько единиц куска уже отрезано (`0` →
ключ удаляется из объекта, как и сейчас для «не готово»). Значение `true`
остаётся только как наследие старых сессий, записанных до этого изменения, и
трактуется при чтении как «полностью готово» — миграция данных не нужна,
запись самовосстанавливается числом при первом же взаимодействии с этим
куском.

Новая чистая функция `features/insulation-progress/lib/resolveDoneCount.ts`:

```ts
export const resolveDoneCount = (raw: number | true | undefined, quantity: number): number =>
  raw === true ? quantity : (raw ?? 0)
```

`applyToggle.ts` заменяется на `applySetCount.ts`:

```ts
export const applySetCount = (
  donePieces: Record<string, number | true>,
  groupPieceId: string,
  count: number,
): Record<string, number | true> => {
  if (count <= 0) {
    const rest = { ...donePieces }
    delete rest[groupPieceId]
    return rest
  }
  return { ...donePieces, [groupPieceId]: count }
}
```

`applyBulk.ts` — вместо списка `groupPieceId[]` принимает список кусков с
количеством (нужно знать `quantity`, чтобы «отметить всё готовым» выставляло
именно полный счётчик, а не `true`):

```ts
export const applyBulk = (
  donePieces: Record<string, number | true>,
  pieces: { linkId: string; quantity: number }[],
  done: boolean,
): Record<string, number | true> => {
  const next = { ...donePieces }
  for (const { linkId, quantity } of pieces) {
    if (done) {
      next[linkId] = quantity
    } else {
      delete next[linkId]
    }
  }
  return next
}
```

`isGroupDone.ts` → `isGroupFullyDone.ts` — группа готова, когда у каждого
куска счётчик достиг количества:

```ts
export const isGroupFullyDone = (
  pieces: { linkId: string; quantity: number }[],
  getDoneCount: (linkId: string, quantity: number) => number,
): boolean =>
  pieces.length > 0 && pieces.every((piece) => getDoneCount(piece.linkId, piece.quantity) >= piece.quantity)
```

`features/insulation-progress/model/useInsulationProgress.ts` — переименования
без изменения механики оптимистичного патча (`updateQueryData`) и 500мс
дебаунс-флаша (`flush`/`timerRef`), которая остаётся как есть:

- `isPieceDone(groupPieceId): boolean` → `getPieceDoneCount(groupPieceId: string, quantity: number): number`
  (резолвит `true` через `resolveDoneCount` внутри, наружу отдаёт готовое число).
- `toggle(groupPieceId)` → `setPieceCount(groupPieceId: string, count: number)`
  (пишет через `applySetCount`, вызывающая сторона сама считает следующее
  значение — карточка знает и текущий счётчик, и `quantity`).
- `setGroupDone(groupId, groupPieceIds, done)` →
  `setGroupDone(groupId, pieces: { linkId: string; quantity: number }[], done: boolean)`
  (пишет через обновлённый `applyBulk`).

### `entities/insulation-piece/ui/InsulationPieceCard`

Пропсы: `isDone: boolean` + `onToggle: () => void` заменяются на
`doneCount: number` + `onChangeCount: (next: number) => void`. `quantity` уже
есть в `piece`.

Производные внутри компонента:

```ts
const isFull = doneCount >= piece.quantity
const isPartial = doneCount > 0 && !isFull
```

Разметка ветвится по `piece.quantity`:

- **`quantity <= 1`** — без изменений в структуре: вся `<article
  role="button">` кликабельна, `onClick` вызывает `onChangeCount(isFull ? 0 :
  1)`. Ноль дополнительной разметки для самого частого случая.
- **`quantity > 1`** — `<article>` перестаёт быть `role="button"`
  (вкладывать `<button>` в элемент с `role="button"` — невалидная вложенность
  интерактивных элементов). Внутри: основная область (иконка/заголовок/статы)
  оборачивается в `<button type="button" className={styles.increment}>` —
  `onClick` вызывает `onChangeCount(isFull ? 0 : doneCount + 1)`. Рядом —
  `<IconButton icon={MinusIcon} label="Убрать одну штуку" onClick={() =>
  onChangeCount(Math.max(0, doneCount - 1))} aria-disabled={doneCount ===
  0} />`, соседний элемент, а не вложенный. Оба остаются в пределах Enter/Space
  доступности через нативную семантику `<button>`.
- Бейдж `«{doneCount} / {piece.quantity}»` (`tabular-nums`) рядом с
  заголовком — только при `quantity > 1`. При `quantity <= 1` заголовок
  остаётся как сейчас (`piece.name`, без суффикса количества — единственный
  экземпляр не нуждается в счётчике).

Стили (`InsulationPieceCard.module.scss`):
- `.done` (`isFull`) — без изменений: cyan-рамка + галочка.
- Новый `.partial` (`isPartial`) — приглушённая подложка `color-mix(in srgb,
  var(--accent) 16%, $color-bg)` (гуще, чем базовые 8%, но не cyan) — без
  галочки, статус несёт бейдж `N/M`.
- Новый `.increment` — растягивается на всю доступную ширину/высоту тела
  карточки, без своей рамки/фона (визуально неотличим от текущего вида тела
  карточки), `@include tap-feedback`, `:focus-visible { @include focus-ring;
  }`.

### Места использования (`widgets/insulation-group-list`, `pages/insulation`)

- `InsulationGroupItem.tsx`: `allDone` считается через `isGroupFullyDone(pieces,
  getPieceDoneCount)`; `hasAnyDone` — `pieces.some((p) =>
  getPieceDoneCount(p.linkId, p.quantity) > 0)`. `handleMarkAll`/`handleUnmark`
  передают в `onSetGroupDone` `pieces.map((p) => ({ linkId: p.linkId, quantity:
  p.quantity }))` вместо плоского списка id. Карточка получает `doneCount=
  {getPieceDoneCount(piece.linkId, piece.quantity)}` и
  `onChangeCount={(next) => onSetPieceCount(piece.linkId, next)}`.
- `InsulationThicknessList.tsx`: та же схема пропсов (`getPieceDoneCount`/
  `onSetPieceCount` вместо `isPieceDone`/`onTogglePiece`), без изменений в
  логике группировки по толщине.
- `pages/insulation/ui/InsulationPage.tsx`: прокидывает переименованные
  `getPieceDoneCount`/`setPieceCount`/`setGroupDone` из
  `useInsulationProgress` вниз без структурных изменений компоновки.
- `InsulationListToolbar`, `useInsulationGroupList`, `groupByThickness`,
  `InsulationStats`, `summarizeByThickness`, `summarizeByGroup` — **не
  меняются**. Они уже считают площадь через `piece.quantity` (сколько всего
  материала в наборе), а не через готовность — частичный прогресс нарезки на
  эти расчёты не влияет.

## Граничные случаи

- `quantity <= 1` (включая гипотетический `0` от некорректных данных) —
  всегда простая разметка-тоггл без степпера; отдельной валидации не
  добавляем, `isFull`/`isPartial` корректно вырождаются (`0/0` → `isFull =
  true` при `doneCount=0`, но такая карточка и так не должна попадать в
  реальные данные — `quantity` кусков вводится с минимумом 1 на уровне формы
  редактирования группы, вне области этого дизайна).
- Легаси `true` в уже сохранённых (в т.ч. завершённых) сессиях — трактуется
  как «полностью готово» при чтении через `resolveDoneCount`, перезаписывается
  числом при следующем изменении этого куска. Если пользователь никогда
  больше не тронет эту карточку — так и останется `true` в БД, что
  по-прежнему корректно читается.
- Смена версии набора / установки — прогресс уже привязан к `(unit, set,
  unitNo)` через `cutting_sessions`, эта часть не меняется.

## Тестирование

Только чистая логика — автотестов на компоненты в проекте нет (см. plan
`docs/superpowers/plans/2026-08-10-insulation-view-controls.md`, тот же
принцип):

- `resolveDoneCount.test.ts` — число возвращается как есть; `true` →
  `quantity`; `undefined` → `0`.
- `applySetCount.test.ts` (замена `applyToggle.test.ts`) — пишет `count` при
  `count > 0`; удаляет ключ при `count <= 0`; не трогает остальные ключи.
- `applyBulk.test.ts` — обновляется под `{ linkId, quantity }[]`: `done=true`
  пишет `quantity` каждому; `done=false` удаляет ключи.
- `isGroupFullyDone.test.ts` (замена `isGroupDone.test.ts`) — пустой список →
  `false`; все куски на полном счётчике → `true`; хотя бы один частичный →
  `false`.

UI — вручную через `pnpm dev` + `pnpm pb`. В прошлой сессии (view controls)
ручная проверка в браузере была пропущена из-за пустой локальной БД —
в этот раз стоит либо засеять тестовые данные, либо иначе получить рабочую
установку с набором изоляции, т.к. фича целиком про интерактивность
(степпер, клики, сброс), которую без браузера не проверить.
