# Фаза 2 изоляции, инкремент 5: ручной ввод unitNo + сохранение

Пятый (и последний нереализованный) пункт «Списка изоляции и отслеживания
прогресса нарезания» (`docs/spec.md`): *«Инпут номера установки. Вводится
вручную»*, вместе с кнопкой «Сохранить» (финализация сессии) — она была явно
отложена в инкременте 3 (`docs/superpowers/specs/2026-08-05-insulation-global-buttons-design.md`
→ «Явно вне рамок») и в инкременте 1 (`docs/superpowers/specs/2026-08-02-insulation-cutting-progress-design.md`
→ «Явно вне рамок», пункт 5 фазы 2).

## Контекст

Сейчас `useInsulationProgress` сам молча вычисляет `unitNo =
(unit.lastCompletedUnitNoInsulation ?? 0) + 1` — UI для этого номера нет,
переключиться на другой физический экземпляр установки (например, второй
комплект, который режется параллельно) невозможно. Схема `cutting_sessions`
уже рассчитана на это: уникальность — по тройке `(unit, set, unitNo)` при
`status = 'in_progress'` (`docs/data-model.md`), `getActiveCuttingSession`
уже принимает `unitNo` как параметр. Не хватает только UI и обвязки вокруг
крайних случаев (повторный ввод уже завершённого номера, порядок
финализации).

## Явно вне рамок этого инкремента

- Миграция схемы PocketBase — не требуется, `cutting_sessions` и `units`
  уже содержат все нужные поля.
- Любые изменения `getActiveCuttingSession`/`updateDonePieces` —
  существующий поток «отметка готовности» не трогаем.
- Страница подсчёта наличия (`stock_sessions`) — отдельная сущность, здесь
  не затрагивается.

## Данные и API — `entities/cutting-session`

### Новые эндпоинты (`api/cuttingSessionApi.ts`)

**`getCuttingSessionByUnitNo({ unitId, setId, unitNo })`** — чистая
проверка существования, **без побочных эффектов** (в отличие от
`getActiveCuttingSession`). `queryFn`, т.к. 404 — валидный результат
(`data: null`), а не ошибка:

```ts
export interface CuttingSessionLookupArgs {
  unitId: UnitId
  setId: InsulationSetId
  unitNo: number
}

getCuttingSessionByUnitNo: builder.query<CuttingSession | null, CuttingSessionLookupArgs>({
  queryFn: async ({ unitId, setId, unitNo }, _api, _opts, baseQuery) => {
    const filter = pb.filter('unit = {:unitId} && set = {:setId} && unitNo = {:unitNo}', { unitId, setId, unitNo })
    const found = await baseQuery({ collection: 'cutting_sessions', method: 'getFirstListItem', filter })
    if (found.data) return { data: normalizeCuttingSession(found.data as CuttingSession) }
    if (found.error && found.error.status !== 404) return { error: found.error }
    return { data: null }
  },
  providesTags: (result) => (result ? [{ type: 'CuttingSession', id: result.id }] : []),
})
```

Фильтр **без** `status = "in_progress"` — единственная точка, которой важен
любой статус, включая `completed`.

**`getInProgressCuttingSessions({ unitId, setId })`** — список для чипов «в
работе». Декларативный `query()`, `getFullList`, фильтр `unit = X && set = Y
&& status = "in_progress"`, `sort: 'unitNo'`. Новый list-тег
`{ type: 'CuttingSession', id: \`LIST_${unitId}_${setId}\` }` — расставляется
и здесь, и инвалидируется `reopenCuttingSession`/`completeCuttingSession`
(создание через `getActiveCuttingSession` уже инвалидирует по id сессии, но
не по list-тегу — его тоже добавляем туда, чтобы новая сессия сразу
появлялась в чипах).

**`reopenCuttingSession({ sessionId, unitId, setId, resetDonePieces })`** —
мутация, `update`: `{ status: 'in_progress', ...(resetDonePieces ? {
donePieces: {} } : {}) }`. Та же запись, новая не создаётся. `unitId`/`setId`
дублируются из уже загруженной сессии (`session.unit`/`session.set`) только
чтобы построить list-тег для инвалидации — сам PocketBase-запрос их не
использует. Инвалидирует `CuttingSession` по id сессии и по
`LIST_${unitId}_${setId}`.

**`completeCuttingSession({ sessionId, unitId, setId, unitNo })`** —
`queryFn` в два шага:

```ts
completeCuttingSession: builder.mutation<
  { unit: RefrigerationUnit },
  { sessionId: CuttingSessionId; unitId: UnitId; setId: InsulationSetId; unitNo: number }
>({
  queryFn: async ({ sessionId, unitId, setId, unitNo }, _api, _opts, baseQuery) => {
    const blockingFilter = pb.filter(
      'unit = {:unitId} && status = "in_progress" && unitNo < {:unitNo}',
      { unitId, unitNo },
    )
    const blocking = await baseQuery({ collection: 'cutting_sessions', method: 'getFullList', params: { filter: blockingFilter } })
    if (blocking.error) return { error: blocking.error }
    const earliest = (blocking.data as CuttingSession[])[0]
    if (earliest) {
      return {
        error: {
          status: 409,
          message: `Установка №${earliest.unitNo} ещё не завершена по изоляции. Сначала завершите её.`,
          data: { blockingUnitNo: earliest.unitNo },
        },
      }
    }

    const sessionUpdate = await baseQuery({ collection: 'cutting_sessions', method: 'update', id: sessionId, body: { status: 'completed' } })
    if (sessionUpdate.error) return { error: sessionUpdate.error }

    const unit = await baseQuery({ collection: 'units', method: 'getOne', id: unitId })
    if (unit.error) return { error: unit.error }
    const current = (unit.data as RefrigerationUnit).lastCompletedUnitNoInsulation ?? 0
    const updated = await baseQuery({
      collection: 'units',
      method: 'update',
      id: unitId,
      body: { lastCompletedUnitNoInsulation: Math.max(current, unitNo) },
    })
    if (updated.error) return { error: updated.error }
    return { data: { unit: updated.data as RefrigerationUnit } }
  },
  invalidatesTags: (_result, _error, { sessionId, unitId, setId }) => [
    { type: 'CuttingSession', id: sessionId },
    { type: 'CuttingSession', id: `LIST_${unitId}_${setId}` },
    { type: 'Unit', id: unitId },
  ],
}),
```

Проверка блокировки — **по всей установке, по всем версиям набора**
(`unit = X`, без `set`), т.к. `lastCompletedUnitNoInsulation` — счётчик
уровня `units`, а не версии набора: два экземпляра одной установки могут
резаться под разными версиями одновременно, и порядок завершения всё равно
общий.

Ошибка блокировки использует `status: 409` как условный маркер (по аналогии
с уже существующим паттерном человекочитаемых сообщений в этом файле —
`'Не удалось получить сессию нарезки'`), различается на UI-уровне по
`error.status === 409` без отдельного типа ошибки.

## Состояние — `features/insulation-set-filter`

`insulationFilterSlice` получает третье поле:

```ts
export interface InsulationFilterState {
  unitId: UnitId | null
  setId: InsulationSetId | null
  // null — нет явного выбора, действует автовычисление
  // (lastCompletedUnitNoInsulation + 1), как currentSet для setId.
  unitNo: number | null
}
```

- `unitSelected` сбрасывает `setId` **и** `unitNo` (новый экземпляр — не тот
  же физический номер по умолчанию).
- `setSelected` (смена версии набора) **не** сбрасывает `unitNo` — версия и
  физический номер независимы (тот же принцип, что «состав установки и
  набор изоляции независимы» в `docs/data-model.md`).
- Новый экшен `unitNoSelected(number | null)`.

`useInsulationSetFilter` добавляет:

```ts
const { data: unit } = /* уже выбранная установка, как в useInsulationProgress */
const defaultUnitNo = unit ? (unit.lastCompletedUnitNoInsulation ?? 0) + 1 : null
const selectedUnitNo = unitNo ?? defaultUnitNo
```

`useInsulationProgress` меняется минимально: принимает `unitNo` снаружи
(параметром) вместо вычисления его сам — вычисление переезжает на уровень
фильтра, чтобы UI инпута и хук прогресса видели одно и то же число.

## UI — инпут и чипы (`features/insulation-set-filter/ui/InsulationFilterBar.tsx`)

Третий контрол после дропдаунов установки/версии:

- **Числовой инпут** с локальным draft-состоянием (`useState`, не сразу в
  Redux) — коммит по `Enter` или `blur`. До коммита ничего не запрашивается.
- **Чипы** под/рядом с инпутом — `getInProgressCuttingSessions(unitId,
  selectedSetId)`, кнопка на каждый номер (`«47»`, `«48»`, …), клик сразу
  коммитит (эквивалент ручного ввода + Enter).
- Оба скрыты, пока не выбраны установка и версия набора (как сейчас скрыт
  сам дропдаун версии, пока не выбрана установка).

### Логика коммита (новый хук `model/useUnitNoCommit.ts` в том же слайсе)

```
commit(n):
  1. getCuttingSessionByUnitNo({ unitId, setId, unitNo: n })
  2. нет записи ИЛИ status === 'in_progress' → dispatch(unitNoSelected(n))
  3. status === 'completed' → open('reopenCuttingSession', { session })
     (unitNo в сторе НЕ меняется, пока модалка не разрешится)
```

## Диалог реоткрытия — `features/cutting-session-reopen`

Новый feature-слайс по образцу `features/component-edit`: модалка
регистрируется в `MODAL_REGISTRY` под ключом `reopenCuttingSession`,
пропсы — `{ session: CuttingSession }`.

`ui/ReopenSessionDialog.tsx` (обёртка над `shared/ui/Modal`):

- Заголовок: `` Установка №${session.unitNo} уже завершена по изоляции ``.
- Текст: краткое пояснение разницы между кнопками.
- Три действия:
  - **«Начать заново»** — `reopenCuttingSession({ sessionId: session.id, unitId: session.unit, setId: session.set, resetDonePieces: true })`.
  - **«Редактировать»** — то же, `resetDonePieces: false`.
  - **«Отмена»** — `close()`, без запроса.
- После успеха первых двух — `dispatch(unitNoSelected(session.unitNo))` и
  `close()`. Ошибка мутации — инлайн-сообщение в модалке (как
  `ComponentEditModal` делает с `saveError`), модалка не закрывается.

## Кнопка «Сохранить» — `widgets/insulation-save-session`

Отдельный виджет, монтируется в `InsulationPage` сразу под
`InsulationGlobalActions`.

`model/useInsulationSaveSession.ts` — принимает `sessionId`, `unitId`,
`setId`, `unitNo`; оборачивает `completeCuttingSession`, плюс
`window.confirm('Сохранить прогресс по установке №{unitNo} и закрыть
сессию?')` перед вызовом. При успехе — `dispatch(unitNoSelected(unitNo +
1))` (переключение на следующий номер, новая активная сессия для него
подхватится существующим `getActiveCuttingSession` как обычно).

`ui/InsulationSaveSession.tsx` — одна акцентная (cyan) кнопка «Сохранить»,
`aria-disabled` пока нет активной сессии или уже идёт запрос, инлайн-текст
ошибки под кнопкой при `status === 409` (сообщение уже готово в
`error.message` от `completeCuttingSession`), иначе — общий фолбэк «Не
удалось сохранить».

## Обработка ошибок

- `getCuttingSessionByUnitNo` — обычная ошибка сети/сервера, стандартный
  `isError` от RTK Query, инпут просто не коммитит новое значение (остаётся
  редактируемым, показывается инлайн-ошибка рядом с инпутом).
- `completeCuttingSession` с `status === 409` — ожидаемый (не
  экстренный) случай, показывается как обычный инлайн-текст, не
  `console.error`.
- `reopenCuttingSession` — при ошибке модалка остаётся открытой с текстом
  ошибки, как уже сделано в `ComponentEditModal`.

## Тестирование

Юнит-тесты (чистая логика):

- Нет новой чистой логики уровня `lib/` — вся новая логика либо в
  `queryFn` (интеграционная, тестируется вручную через `pnpm dev` +
  PocketBase, как и существующий `getActiveCuttingSession`), либо в
  редьюсере слайса (`unitNoSelected` — тривиальный сеттер, отдельного теста
  не требует, по аналогии с `setSelected`).

Ручная проверка через `pnpm dev`:

- ввод произвольного нового номера → создаётся новая сессия, не мешает уже
  активной для другого номера;
- переключение между двумя параллельными in-progress номерами через чипы —
  прогресс каждого сохраняется независимо;
- повторный ввод номера с завершённой сессией → модалка, все три действия;
- «Отмена» в модалке не меняет текущий выбранный номер;
- «Сохранить» при наличии более раннего in_progress номера по установке
  (в любой версии набора) → блокируется с понятным сообщением;
- «Сохранить» без блокировки → `units.lastCompletedUnitNoInsulation`
  обновляется, номер в фильтре переключается на N+1;
- смена версии набора не сбрасывает выбранный `unitNo`, смена установки —
  сбрасывает;
- работа с клавиатуры (Tab/Enter на инпуте и чипах, фокус в модалке).

`pnpm check` — обязательно перед коммитом.
