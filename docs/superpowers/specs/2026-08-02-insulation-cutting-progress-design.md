# Фаза 2 изоляции, инкремент 1: отметка готовности куска

Первый инкремент «Списка изоляции и отслеживания прогресса нарезания»
(`docs/spec.md` → раздел с этим названием). Фундамент, от которого зависят
следующие инкременты (групповые действия, статистика/графики, финализация
с сохранением номера установки, ручной ввод `unitNo`).

## Контекст

Фаза 1 (см. `fb46721`) уже даёт фильтры, аккордеон групп и карточки кусков —
но только на чтение. `InsulationPieceCard.module.scss` уже содержит
опережающий комментарий: «клик — отметка готовности, фаза 2».

Схема `cutting_sessions` уже создана в `pb_migrations/1785597925_initial_schema.js`
и не требует изменений: `unit`, `set`, `unitNo`, `donePieces` (json), `status`
(`in_progress` | `completed`), `user`, плюс уникальный partial-индекс
`(unit, set, unitNo) WHERE status = 'in_progress'`. Тег `CuttingSession` уже
зарезервирован в `shared/api/tags.ts`. Правила доступа открыты (`""`), как и у
остальных коллекций до появления авторизации.

## Явно вне рамок этого инкремента

- Инпут ручного ввода `unitNo` (пункт 5 фазы 2) — `unitNo` считается
  автоматически, без UI.
- Кнопки массовых действий на группу и глобально («отметить все готовым»,
  «снять готовность», «Сохранить») — пункты 2 и 4.
- Статистика и графики (кольцевой по группам, столбчатый по толщинам) —
  пункт 3.
- Обновление `units.lastCompletedUnitNoInsulation` — часть финализации
  (пункт 4), не этого инкремента.

## Данные и API — `entities/cutting-session`

### Типы (`model/types.ts`)

```ts
export type CuttingSessionId = string & { readonly __brand: 'CuttingSessionId' }

export interface CuttingSession {
  id: CuttingSessionId
  unit: UnitId
  set: InsulationSetId
  unitNo: number
  // Ключ — id записи group_pieces (то же значение, что уже используется как
  // InsulationPieceWithQuantity.linkId). Не брендируем: linkId в
  // entities/insulation-piece и entities/insulation-group тоже не брендирован.
  donePieces: Record<string, true>
  status: 'in_progress' | 'completed'
  user: UserId
  updated: string
}
```

### API (`api/cuttingSessionApi.ts`)

**`getActiveCuttingSession({ unitId, setId, unitNo, userId })`** — query с
побочным эффектом (get-or-create), реализована через `queryFn` (не через
декларативный `pocketbaseBaseQuery` — нужна многошаговая логика):

1. `getFirstListItem` с фильтром `unit = X && set = Y && unitNo = Z && status = 'in_progress'`.
2. Если 404 — создаём новую запись (`status: 'in_progress'`, `donePieces: {}`,
   `user: userId`).
3. Если создание падает на уникальном индексе (гонка — другое устройство уже
   создало сессию на ту же тройку) — просто перечитываем шаг 1.

`unitNo` и `userId` вычисляет вызывающий хук (см. ниже) — сам entity-слой не
знает про `refrigeration-unit`/`user`, кроме как через типы id.

`providesTags: [{ type: 'CuttingSession', id: result.id }]`.

**`updateDonePieces({ sessionId, donePieces })`** — обычная декларативная
`update`-мутация (`pocketbaseBaseQuery`, метод `update`).

**Realtime** — `onCacheEntryAdded` на `getActiveCuttingSession`:
дожидается `cacheDataLoaded`, подписывается на конкретную запись через
`pb.collection('cutting_sessions').subscribe(session.id, ...)`, при чужом
`update` патчит кеш через `updateCachedData`, отписывается в
`cacheEntryRemoved`. Первая realtime-подписка в проекте — задаёт паттерн для
будущих (`stock_sessions` и т.п.).

## Оптимистичное обновление и UI — `features/insulation-progress`

Слайс называется без привязки к «одному клику» — в следующих инкрементах сюда
же лягут групповые/глобальные действия поверх той же активной сессии.

### Чистые функции (`lib/`)

- `applyToggle(donePieces, groupPieceId): Record<string, true>` — переключает
  один ключ (добавляет/удаляет). Юнит-тест.
- `isGroupDone(pieceLinkIds, donePieces): boolean` — `true`, если список кусков
  не пуст и каждый `linkId` есть в `donePieces`. Юнит-тест.

### Хук (`model/useInsulationProgress.ts`)

`useInsulationProgress({ unitId, setId })`:

1. Берёт текущего пользователя (`useGetFirstUserQuery`) и установку — через уже
   закешированный `useGetUnitsQuery` (не создаёт лишнего запроса, т.к. фильтр-бар
   уже держит этот же кеш прогретым).
2. Считает `unitNo = (unit.lastCompletedUnitNoInsulation ?? 0) + 1`.
3. `useGetActiveCuttingSessionQuery({ unitId, setId, unitNo, userId })`, либо
   `skipToken`, пока unit/set/user не готовы.
4. `toggle(groupPieceId)`:
   - сразу патчит кеш RTK Query через
     `cuttingSessionApi.util.updateQueryData(...)` и `applyToggle` —
     визуальная отметка происходит мгновенно, без ожидания сети;
   - (пере)запускает таймер 500мс.
5. По истечении таймера — читает **актуальное** значение кеша (не значение из
   замыкания на момент клика) и отправляет `updateDonePieces`.
6. То же самое, немедленно и без ожидания таймера — при размонтировании или
   смене `setId`, чтобы не терять недописанный прогресс.
7. Возвращает `{ isPieceDone(groupPieceId), toggle(groupPieceId), isLoading }`.

Никакого нового redux-слайса — серверные данные (сессия) живут только в кеше
RTK Query, дебаунс и таймер — локальное состояние хука (`useRef`), не
дублирование сервера.

### Компоненты

- **`InsulationPieceCard`** — новые пропсы `isDone: boolean`,
  `onToggle: () => void`. Вся карточка кликабельна: `role="button"`,
  `tabIndex={0}`, `onClick` и `onKeyDown` (Enter/Space) — обязательна работа с
  клавиатуры. Визуальное состояние `isDone`: ледяной cyan-акцент/бейдж-галочка,
  короткий scale-эффект 150–200мс на переключение, с уважением
  `prefers-reduced-motion` (CLAUDE.md → «Дизайн-направление»).
- **`InsulationPage`** — единственное место вызова `useInsulationProgress`.
  `isPieceDone`/`toggle` прокидываются вниз как пропсы через
  `InsulationGroupList` → `InsulationGroupItem` → `InsulationPieceCard`
  (контейнер тянет данные, UI-компоненты только рисуют — CLAUDE.md).
- **`InsulationGroupItem`** — считает
  `allDone = pieces.length > 0 && pieces.every(p => isPieceDone(p.linkId))`
  через `isGroupDone` и показывает акцентную галочку на `Accordion.Trigger`,
  когда группа полностью готова. Никакой отдельной логики — чистое
  производное от индивидуальных отметок.

## Обработка ошибок

Если `updateDonePieces` падает — инвалидируем тег `CuttingSession` этой
сессии, чтобы перечитать актуальное состояние с сервера. В проекте пока нет
инфраструктуры тостов/уведомлений — не добавляем её ради этого, молчаливый
ресинк достаточен для внутреннего инструмента на этом этапе.

## Известное ограничение (сознательно не решаем сейчас)

Realtime-эхо своей же записи может на долю секунды откатить только что
поставленную локально отметку, если два дебаунс-цикла с разных устройств
накладываются на одну и ту же группу почти одновременно (устройство А ещё не
отправило накопленный тоггл Б, а эхо предыдущей отправки А уже пришло и
перезаписало `donePieces` в кеше). Самоисправляется следующим flush — окно
меньше секунды, конкурентная правка одной и той же группы с двух устройств
одновременно — редкий сценарий для этого инструмента. Если на практике
станет заметной проблемой — добавим версионирование записи (revision-counter
или сравнение `updated`); сейчас это была бы преждевременная сложность (YAGNI).

## Тестирование

- `applyToggle`, `isGroupDone` — юнит-тесты, как остальные `lib`-функции в
  проекте (`vitest`).
- Дебаунс/оптимистика/realtime-подписка — связующий код поверх RTK Query; в
  проекте пока нет прецедента тестирования таких хуков через MSW — оставляем
  без юнит-тестов на этом этапе, проверяем вручную через `pnpm dev` в браузере
  (включая работу клика с клавиатуры и на двух вкладках/устройствах для
  realtime).
- `pnpm check` — обязательно перед коммитом, как обычно.
