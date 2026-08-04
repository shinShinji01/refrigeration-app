# Фаза 2 изоляции, инкремент 2: групповые кнопки отметки готовности

Второй инкремент «Списка изоляции и отслеживания прогресса нарезания»
(`docs/spec.md`). Строится поверх инкремента 1
(`docs/superpowers/specs/2026-08-02-insulation-cutting-progress-design.md`,
смёржен в `master`) — переиспользует ту же активную сессию нарезки и тот же
дебаунс/flush, без изменений в `toggle`.

## Контекст

Сейчас в `InsulationGroupItem` можно отметить готовность только по одному
куску (`InsulationPieceCard`). Бейдж-галочка в шапке группы уже показывает,
когда группа полностью готова (`isGroupDone`), но чтобы отметить всю группу,
нужно раскрыть её и прощёлкать каждый кусок вручную.

## Явно вне рамок этого инкремента

- Глобальные кнопки на странице («отметить все установки», «снять все») —
  отдельный последующий инкремент.
- Кнопка «Сохранить» (финализация сессии, обновление
  `units.lastCompletedUnitNoInsulation`) — отдельный последующий инкремент.
- Статистика и графики — пункт 3 фазы 2, не этот инкремент.
- Миграция набора иконок проекта на готовый пакет — отдельная тема дизайн-системы,
  не связанная с этим инкрементом; здесь продолжаем рисовать кастомные SVG в
  существующем stroke-стиле (`shared/assets/icons`).

## Данные и API

Изменений в `entities/cutting-session` не требуется — `updateDonePieces`
принимает произвольный `donePieces`, ему всё равно, один ключ поменялся или
много.

## Оптимистичное обновление и UI — `features/insulation-progress`

### Чистая функция (`lib/applyBulk.ts`)

`applyBulk(donePieces: Record<string, true>, groupPieceIds: string[], done: boolean): Record<string, true>`
— при `done === true` добавляет все `groupPieceIds` как ключи (`true`), при
`done === false` удаляет все `groupPieceIds` из объекта. Всегда возвращает
новый объект (как `applyToggle`), идемпотентна: повторный вызов с тем же
`done` не меняет результат. Юнит-тест по образцу `applyToggle.test.ts` —
пустой `groupPieceIds`, все ключи уже в нужном состоянии, частичное
пересечение.

### Хук `useInsulationProgress` — новое

**Уточнение сигнатуры относительно вчерашнего черновика:** `setGroupDone`
принимает `groupId`, а не только `groupPieceIds` — он нужен, чтобы хук мог
сообщить UI, какая именно группа сейчас ждёт подтверждения с сервера (см.
ниже про спиннер). Значение — `group.linkId` (та же id, что уже используется
как `Accordion.Item value` и React-ключ группы), не `group.id`.

```ts
setGroupDone(groupId: string, groupPieceIds: string[], done: boolean): void
```

Поведение:

1. Патчит кеш через `cuttingSessionApi.util.updateQueryData` и `applyBulk` —
   так же мгновенно, как `toggle`.
2. Добавляет `groupId` в `pendingGroupIds` (см. ниже).
3. (Пере)запускает тот же `timerRef`/`flush` на 500мс — **общий** таймер с
   `toggle`, отдельного таймера на группу нет.

**`pendingGroupIds: ReadonlySet<string>`** — новое состояние хука
(`useState`, не `useRef` — должно вызывать перерисовку). Не единственный
`pendingGroupId: string | null`, как было в черновом варианте: если
пользователь успеет кликнуть кнопку на второй группе до срабатывания общего
дебаунса (окно 500мс, редко, но возможно), обе группы всё ещё физически ждут
один и тот же `flush` — набор, а не одно значение, не даёт первой группе
преждевременно "потерять" спиннер, когда произошёл клик по второй.

- `setGroupDone` добавляет `groupId` в набор.
- `flush` при завершении (успех **или** ошибка — ошибка уже обрабатывается
  существующим `onQueryStarted` в `updateDonePieces` через ресинк по тегу)
  полностью очищает набор — весь накопленный к этому моменту прогресс либо
  подтверждён, либо будет перечитан с сервера целиком.

Реализация: `flush` оборачивает вызов `updateDonePieces(...)` — сейчас это
fire-and-forget; чтобы очистить `pendingGroupIds` по завершении, `flush`
берёт возвращаемый thunk-промис и очищает набор в `finally` после
`.unwrap().catch(() => {})` (сама ошибка уже обработана резинком в
`onQueryStarted`, здесь нам нужен только факт "запрос завершился").

Хук возвращает:

```ts
{ isPieceDone, toggle, setGroupDone, pendingGroupIds, isLoading }
```

### Компоненты

**`InsulationGroupItem`** — новые пропсы:

```ts
pendingGroupIds: ReadonlySet<string>
onSetGroupDone: (groupId: string, groupPieceIds: string[], done: boolean) => void
```

- `isPending = pendingGroupIds.has(group.linkId)`.
- `hasAnyDone = pieces.some((p) => isPieceDone(p.linkId))`.
- Кнопки — соседний элемент `Accordion.Trigger` внутри `Accordion.Header`
  (не вложенные: Radix рендерит `Trigger` как нативный `<button>`, вложенные
  `<button>` невалидны). Визуально та же строка за счёт flex на `Header`.
- Не рендерятся, если `pieces.length === 0` или `isLoading`.
- «Отметить всё готовым» (`IconButton`, новая иконка `mark-all.svg` —
  двойная галочка внахлёст, названа по действию, как `archive.svg`/
  `unarchive.svg`, а не по форме): `disabled` при `allDone || isPending`.
  Вызывает `onSetGroupDone(group.linkId, pieces.map(p => p.linkId), true)`.
- «Снять готовность» (`IconButton`, существующая `close.svg` — переиспользуем
  так же, как `check.svg` уже переиспользован для бейджа готовности группы):
  `disabled` при `!hasAnyDone || isPending`.
  Вызывает `onSetGroupDone(group.linkId, pieces.map(p => p.linkId), false)`.
- Пока `isPending`: обе кнопки `disabled`. Та, что была нажата последней (по
  которой сейчас идёт ожидание), показывает спиннер вместо иконки — состояние
  "какая именно кнопка была нажата" хранится локально в
  `InsulationGroupItem` (`useState<'markAll' | 'unmark' | null>`), сбрасывается
  тоже когда `isPending` становится `false`. Вторая кнопка группы просто
  `disabled`, без спиннера.
- Название группы (`.name`): `text-overflow: ellipsis; white-space: nowrap;
  overflow: hidden` + атрибут `title={group.name}` (десктоп-hover). Кнопки
  всегда в одной строке с шевроном/названием/бейджем/счётчиком — без переноса
  по брейкпоинтам.

**`InsulationGroupList`** — прокидывает `pendingGroupIds`/`onSetGroupDone`
вниз без изменений (та же цепочка, что уже есть для `isPieceDone`/
`onTogglePiece`).

**`InsulationPage`** — берёт `setGroupDone`/`pendingGroupIds` из
`useInsulationProgress`, прокидывает как `onSetGroupDone`/`pendingGroupIds`.

## Обработка ошибок

Без изменений относительно инкремента 1 — `updateDonePieces` сам
ресинкается по ошибке через инвалидацию тега `CuttingSession`. Новое здесь —
только то, что `pendingGroupIds` корректно очищается и в случае ошибки (см.
выше), чтобы кнопки не остались бессрочно disabled/со спиннером.

## Тестирование

- `applyBulk` — юнит-тесты по TDD, по образцу `applyToggle.test.ts`.
- Ручная проверка через `pnpm dev`: скрытие кнопок при пустой/загружающейся
  группе, disabled-логика обеих кнопок по отдельности, спиннер только на
  нажатой кнопке при одновременном disabled второй, ellipsis на длинном
  названии группы (десктоп + узкий вьюпорт), работа с клавиатуры (кнопки —
  обычные `IconButton`, фокус/`Enter`/`Space` уже поддержаны компонентом).
- Дебаунс/`pendingGroupIds`-хук — как и в инкременте 1, без юнит-тестов на
  этом этапе (нет прецедента тестирования RTK Query хуков через MSW в
  проекте), проверяем вручную.
- `pnpm check` — обязательно перед коммитом.
