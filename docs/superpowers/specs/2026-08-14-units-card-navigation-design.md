# Список сборочных единиц — клик-навигация, фикс кнопки сортировки, хлебные крошки — Design

## Контекст

На странице `/units` три независимые проблемы, затронутые одним заходом по
просьбе пользователя (разговор 2026-08-14):

1. Карточки в списке (`ComponentListCard` → `UnitCard`/`AssemblyCard`/`PartCard`)
   сейчас кликабельны только по чекбоку выделения (для массовых действий —
   архивация/удаление) и по кнопке-карандашу (редактирование). Единственный
   способ «провалиться» в узлы/детали конкретной установки — выбрать её в
   `Combobox` `CascadeFilter`. Хочется, чтобы клик по самой карточке в сетке
   делал то же самое, что выбор в дропдауне.
2. Кнопка сортировки (`SortButton.trigger`, `height: 44px`) на ~1.6px ниже
   соседних `Combobox`-полей (`.control`, `@include touch-target` — только
   `min-height`, реальная высота от контента — 45.6px). Тот же класс бага,
   что чинили в `InsulationListToolbar` для кнопки «Свернуть все» (см.
   `docs/superpowers/specs/2026-08-14-insulation-filterbar-labels-toolbar-design.md`).
3. Дерево установка → узел → деталь сейчас навигируется только через три
   независимых дропдауна — нет способа посмотреть/поменять путь одним
   взглядом или быстро подняться на уровень вверх, кроме как открыть нужный
   дропдаун и почистить его.

Ключевые решения, принятые в разговоре:

- Клик-навигация работает **только в обычном режиме просмотра** (без текста
  в поиске) — в результатах глобального поиска карточки разных типов
  показаны вперемешку без общего родителя, и однозначно определить, в какую
  установку проваливаться при клике на узел, нельзя (узел может быть
  переиспользован в нескольких установках).
- Кнопка сортировки — высота выравнивается по `Combobox`, а не наоборот.
- Навигация по дереву — хлебные крошки над сеткой карточек, видны только
  когда есть выбор (`parent !== null`).

## Архитектура

### 1. Клик по карточке-ребёнку → выбор в каскадном фильтре

`ComponentList.tsx` уже различает два случая рендера карточки: `compact: true`
— карточка-ребёнок в сетке (`renderCard(item, ..., true)`), `compact`
не задан — карточка-родитель слева в split-раскладке. Это ровно тот сигнал,
который нужен: клик-навигация имеет смысл только для карточек-детей, потому
что родитель уже выбран, а деталь (`part`) не имеет потомков.

`ComponentListCard.tsx` получает доступ к `useCascadeFilter()` и строит
`onOpen` только когда карточка одновременно `compact` и не `part`:

```tsx
const { selectUnit, selectAssembly } = useCascadeFilter()

const onOpen = useMemo(() => {
  if (!compact) return undefined
  if (item.kind === 'unit') return () => selectUnit(item.unit.id)
  if (item.kind === 'assembly') return () => selectAssembly(item.assembly.id)
  return undefined // part — потомков нет
}, [compact, item, selectUnit, selectAssembly])
```

`onOpen` пробрасывается в `UnitCard`/`AssemblyCard` (новый опциональный проп
`onOpen?: () => void`) и дальше — в общий `ComponentCard`. `PartCard` проп не
получает вовсе (нет смысла — `useFilteredComponents` для `part` всегда
возвращает пустой `childItems`).

Никакого нового состояния не заводится — `selectUnit`/`selectAssembly`
диспатчат существующие `unitSelected`/`assemblySelected` в
`cascadeFilterSlice`, которые уже каскадно сбрасывают `assemblyId`/`partId`
при смене родителя. `useFilteredComponents` пересчитывает `parent`/
`childItems` от этого состояния — тот же путь, что и при выборе в
`Combobox`.

`shared/ui/ComponentCard.tsx` — добавляется опциональный `onOpen`:

```tsx
interface ComponentCardProps {
  // ...существующие пропы
  onOpen?: () => void
}

export const ComponentCard = ({ /* ... */ onOpen }: ComponentCardProps) => {
  const card = (
    <article
      className={clsx(styles.root, /* ... */, onOpen && styles.clickable)}
      style={style}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen()
              }
            }
          : undefined
      }
    >
      {onSelectedChange || onEdit ? (
        <div
          className={styles.cornerActions}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {/* чекбокс/кнопка редактирования — без изменений */}
        </div>
      ) : null}
      <Icon className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>{/* без изменений */}</div>
      {onOpen ? <ChevronIcon className={styles.openChevron} aria-hidden="true" /> : null}
    </article>
  )
  // ...
}
```

`stopPropagation` на обёртке `.cornerActions` (и на `click`, и на `keydown`)
изолирует чекбокс выделения и кнопку редактирования от нового клика на
карточке — они продолжают работать независимо, клик по ним не триггерит
`onOpen`.

`role="button"`/`tabIndex`/`onKeyDown` на самой карточке — доступность с
клавиатуры и читалок экрана (CLAUDE.md → «видимый focus-ring, работа с
клавиатуры»); `:focus-visible` на `.clickable` использует существующий
миксин `focus-ring`.

Шеврон (`ChevronIcon` — переиспользуется существующая `chevron.svg`, уже
используется в `InsulationGroupItem` для разворота групп) — визуальная
подсказка «сюда можно провалиться», показывается только когда `onOpen`
задан (то есть только на `unit`/`assembly`, никогда на `part`).

```scss
.clickable {
  cursor: pointer;
}

.openChevron {
  align-self: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: $color-text-muted;
  transform: rotate(-90deg); // как в InsulationGroupItem — «вниз» по умолчанию, разворачиваем на «вправо»
}
```

### 2. Высота `Combobox.control`

`shared/ui/Combobox/Combobox.module.scss`:

```scss
.control {
  display: flex;
  align-items: center;

  @include touch-target;
  height: $touch-target-min; // фиксирует высоту — раньше только min-height, контент растягивал до 45.6px

  border: 1px solid $color-border;
  border-radius: $radius-sm;
  background: $color-bg;

  &:focus-within {
    @include focus-ring;
  }
}
```

Один общий компонент, правка в одном месте чинит несоответствие сразу и на
`/units` (`CascadeFilter`), и на `/insulation` (`InsulationFilterBar`, тот же
`Combobox` через `FloatingLabelField`).

### 3. Хлебные крошки

Новый компонент `features/cascade-filter/ui/CascadeBreadcrumbs.tsx` —
дополнение к уже существующему в этом слайсе `CascadeFilter` (та же
доменная область: чтение/запись `cascadeFilterSlice`), экспортируется через
`features/cascade-filter/index.ts`.

```tsx
interface CascadeBreadcrumbsProps {
  includeArchived: boolean // тот же аргумент, что и у CascadeFilter — общий кэш RTK Query, без лишних запросов
}

export const CascadeBreadcrumbs = ({ includeArchived }: CascadeBreadcrumbsProps) => {
  const { unitId, assemblyId, partId, selectUnit, selectAssembly, selectPart } = useCascadeFilter()

  const { data: units = [] } = useGetUnitsQuery({ includeArchived })
  const { data: assemblies = [] } = useGetAssembliesForUnitQuery(unitId ?? skipToken)
  const { data: parts = [] } = useGetPartsForAssemblyQuery(assemblyId ?? skipToken)

  if (!unitId) return null // видны только когда parent !== null

  const unit = units.find((candidate) => candidate.id === unitId)
  const assembly = assemblyId ? assemblies.find((candidate) => candidate.id === assemblyId) : undefined
  const part = partId ? parts.find((candidate) => candidate.id === partId) : undefined

  return (
    <nav className={styles.root} aria-label="Хлебные крошки">
      <ol className={styles.list}>
        <li>
          <button type="button" className={styles.crumb} onClick={() => selectUnit(null)}>
            Установки
          </button>
        </li>
        {unit ? (
          <li>
            {assembly || part ? (
              <button type="button" className={styles.crumb} onClick={() => selectAssembly(null)}>
                {unit.name}
              </button>
            ) : (
              <span className={styles.current} aria-current="page">{unit.name}</span>
            )}
          </li>
        ) : null}
        {assembly ? (
          <li>
            {part ? (
              <button type="button" className={styles.crumb} onClick={() => selectPart(null)}>
                {assembly.name}
              </button>
            ) : (
              <span className={styles.current} aria-current="page">{assembly.name}</span>
            )}
          </li>
        ) : null}
        {part ? (
          <li>
            <span className={styles.current} aria-current="page">{part.name}</span>
          </li>
        ) : null}
      </ol>
    </nav>
  )
}
```

Разделитель между сегментами — через `::before` на `li + li` (символ «›»),
не отдельный DOM-узел. Кликабельные сегменты — приглушённый текст
(`$color-text-muted`, как ссылки в `SortButton`), текущий (последний) —
`$color-text`, без интерактивности. Перенос строки разрешён (`flex-wrap:
wrap`) — на мобильном с длинными названиями крошки переносятся, а не
обрезаются и не уезжают в горизонтальный скролл (YAGNI для первой версии).

`UnitsPage.tsx` — рендерится между `FilterBar` и `ComponentList`:

```tsx
<FilterBar ... />
<CascadeBreadcrumbs includeArchived={includeArchived} />
<ComponentList parent={parent} childItems={childItems} isLoading={isLoading} />
```

## Граничные случаи

- Клик по карточке во время активного текстового поиска — `onOpen` не
  строится (`compact` всё ещё `true` в сетке результатов поиска, но нужен
  доп. признак «не в режиме поиска»; см. ниже, п. «Уточнение реализации»).
- Повторный клик по уже выбранной карточке — невозможен: как только
  `unit`/`assembly` выбраны, они переезжают в `parent`-ячейку
  (`compact` не задан), клик-обработчик там не строится.
- Раскрытие карточки по ховеру (`compactCard:hover` — раскрывает список
  дочерних элементов) и клик-навигация не конфликтуют: раскрытие — чисто
  CSS-эффект на `:hover`/`:focus-within`, `onClick` срабатывает по клику
  в любом месте раскрытой или свёрнутой карточки одинаково.
- Хлебные крошки при отсутствии данных в кэше (например, прямой заход по
  URL с уже выбранным `unitId` до того, как отработал `useGetUnitsQuery`) —
  `unit`/`assembly`/`part` через `.find()` временно `undefined`, соответствующий
  сегмент просто не рендерится до прихода данных; после — появляется без
  доп. состояния загрузки (тот же паттерн, что уже в `CascadeFilter.tsx`).
- Архивная установка/узел, выбранные ранее, но скрытые чекбоксом «Показать
  архивные» — `includeArchived` в `CascadeBreadcrumbs` передаётся тем же
  значением, что в `FilterBar`/`CascadeFilter`, так что видимость сегмента
  крошки согласована с видимостью самой карточки в списке.

### Уточнение реализации: определение «режима поиска» для клика по карточке

`ComponentListCard` не знает про `search` напрямую (его нет в
`ComponentListItem`). Проброс: `UnitsPage` уже вычисляет `isGlobalSearch`
внутри `useFilteredComponents` (не возвращает наружу). Добавляется в
возвращаемый `UseFilteredComponentsResult` новое поле:

```ts
interface UseFilteredComponentsResult {
  parent: ComponentListItem | null
  childItems: ComponentListItem[]
  isLoading: boolean
  isGlobalSearch: boolean // новое
}
```

`UnitsPage.tsx` пробрасывает его в `ComponentList` → `ComponentListCard`
(проп `enableDrilldown: boolean`, равный `!isGlobalSearch`). `onOpen` в
`ComponentListCard` строится только при `compact && enableDrilldown &&
item.kind !== 'part'`.

## Тестирование

Чистой бизнес-логики немного (`onOpen` — тонкая обвязка над уже
протестированным `cascadeFilterSlice`; `isGlobalSearch` уже вычисляется и
неявно покрыт существующими тестами `useFilteredComponents`, если они есть,
иначе — ручная проверка). Проверка вручную через `pnpm dev` + `pnpm pb` на
`/units`:

- На списке всех установок (без выбора, без поиска) — клик по телу карточки
  (не по чекбоксу/карандашу) выбирает установку в дропдауне «Установка» и
  показывает её узлы.
- В сетке узлов выбранной установки — клик по узлу выбирает его в дропдауне
  «Узел», показывает детали.
- Клик по карточке детали — ничего не делает (нет шеврона, `cursor` обычный).
- Чекбокс выделения и кнопка редактирования на карточке-ребёнке продолжают
  работать сами по себе, не запуская переход.
- То же самое — с клавиатуры (Tab до карточки, Enter/Space).
- Глобальный поиск (текст без выбранной установки) — клик по найденной
  карточке любого типа не проваливается (шеврона нет, не кликабельна).
- Кнопка сортировки и поля `Установка`/`Узел`/`Деталь` — одна высота,
  выровнены по нижнему краю в строке `.filterRow`.
- Хлебные крошки: не видны на списке всех установок; появляются при выборе
  установки (`Установки › <имя>`), растут при выборе узла/детали; клик по
  некликабельному (последнему) сегменту ничего не делает; клик по «Установки»
  сбрасывает весь путь; клик по промежуточному сегменту поднимает на этот
  уровень и сохраняет корректное состояние дропдаунов (они управляются тем
  же `cascadeFilterSlice`).
