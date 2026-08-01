# Структура src

Слои: `app → pages → widgets → features → entities → shared`. Импорт только вниз.

```
src/
├── app/
│   ├── providers/          StoreProvider, RouterProvider, ModalProvider
│   ├── store/              configureStore, rootReducer, typed hooks
│   ├── routes/             routes.tsx, paths.ts
│   ├── styles/             _tokens, _mixins, _functions, _breakpoints, _reset, index
│   └── App.tsx
│
├── pages/                  только композиция виджетов, без логики
│   ├── units/              список сборочных единиц
│   ├── stock/              подсчёт наличия и излишков
│   ├── insulation/         список изоляции и прогресс нарезки
│   └── not-found/
│
├── widgets/
│   ├── sidebar/            сайдбар: десктоп-коллапс, мобильная верхняя полоса
│   ├── filter-bar/         поиск + чекбокс архива + каскадные дропдауны
│   ├── component-list/     сетка карточек, сортировка, группировка, виртуализация
│   ├── selection-bar/      sticky-панель действий над выделенными
│   ├── insulation-group-list/  аккордеоны групп с карточками кусков
│   └── stats-panel/        статистика + графики
│
├── features/               по одному пользовательскому сценарию
│   ├── component-search/
│   ├── cascade-filter/     установка → узел → деталь, зависимая активность
│   ├── component-selection/
│   ├── component-archive/  архивация/разархивация, массово
│   ├── component-edit/     модалка редактирования
│   ├── children-picker/    добавление дочерних элементов с количеством
│   ├── stock-count/        ввод наличия, расчёт комплектов и остатка
│   ├── cutting-progress/   отметки готовности, сессия, синхронизация
│   └── shape-editor/       рисование геометрии куска на SVG
│
├── entities/               сегменты: model / api / ui / lib
│   ├── refrigeration-unit/
│   ├── assembly/
│   ├── part/
│   ├── insulation-set/
│   ├── insulation-group/
│   ├── insulation-piece/
│   ├── session/            cutting + stock сессии
│   └── user/
│
└── shared/
    ├── api/                pocketbase.ts, baseQuery.ts, baseApi.ts, tags.ts
    ├── ui/                 Button, IconButton, Input, NumberInput, Combobox,
    │   │                   Checkbox, Modal, Card, Accordion, Badge, Chip,
    │   │                   Toolbar, EmptyState, Skeleton, Toast
    │   └── charts/         DonutChart, BarChart — свои, на SVG
    ├── lib/
    │   ├── geometry/       computeArea, withComputedArea, boundingBox, isSelfIntersecting
    │   ├── hooks/          useDebounce, useMediaQuery, useOnClickOutside, useStickyVisible
    │   └── utils/          groupBy, sortBy, formatArea, formatDrawingNo
    ├── config/             menu.ts — пункты сайдбара, componentTypes.ts — цвета/иконки типов
    └── assets/icons/       svg, подключаются через svgr
```

## Ключевые решения по декомпозиции

**Три типа карточек — один компонент.** `ComponentCard` в `shared/ui` принимает
`type`, `accent`, `icon`, `children`. Конкретика — в `entities/*/ui/UnitCard.tsx`
и т.д., которые оборачивают базовую. Цвета и иконки типов — в
`shared/config/componentTypes.ts`, одна таблица на всё приложение.

**Модалки.** `ModalProvider` в `app/providers` держит стек открытых модалок и
рендерит их по имени. Открытие — `useModal().open('editComponent', { id })`.
Модалок будет много, поэтому реестр, а не `useState` в каждом виджете.

**Каскадные дропдауны.** Состояние фильтра — в слайсе `features/cascade-filter`,
не в url и не в компоненте. Из него выводятся `disabled`-состояния соседей и
аргументы запроса. Сброс дочерних при смене родителя — в одном редьюсере,
а не размазан по обработчикам.

**Меню сайдбара** — массив объектов в `shared/config/menu.ts`:
`{ id, path, labelKey, Icon, isDisabled }`. Компонент сайдбара его только рендерит.

**Расчёты.** Комплекты/остатки и площади — чистые функции в `entities/*/lib`,
покрытые тестами. Ни одного вычисления внутри компонента.
