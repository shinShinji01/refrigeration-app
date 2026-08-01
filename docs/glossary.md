# Глоссарий

Домен русский, код английский. Одна сущность — одно английское имя, без синонимов.
При сомнении — сюда, а не выдумывать.

## Сущности

| Русский | Код | Коллекция PocketBase | Пояснение |
|---|---|---|---|
| Холодильная установка | `RefrigerationUnit` | `units` | Конечное изделие |
| Сборочный узел | `Assembly` | `assemblies` | Собирается из деталей, входит в установку |
| Деталь сборочного узла | `Part` | `parts` | Атомарный элемент |
| Набор изоляции (версия) | `InsulationSet` | `insulation_sets` | Версионируемый набор групп для установки |
| Группа теплоизоляции | `InsulationGroup` | `insulation_groups` | Логическая группа кусков |
| Кусок теплоизоляции | `InsulationPiece` | `insulation_pieces` | Единица раскроя, имеет геометрию |
| Пользователь | `User` | `users` | Пока без регистрации, берём из БД |

## Связи (many-to-many с количеством)

| Русский | Код | Коллекция |
|---|---|---|
| Состав установки (узлы) | `UnitAssembly` | `unit_assemblies` |
| Состав узла (детали) | `AssemblyPart` | `assembly_parts` |
| Состав детали (вложенные детали) | `PartComposition` | `part_parts` |
| Состав набора (группы) | `SetGroup` | `set_groups` |
| Состав группы (куски) | `GroupPiece` | `group_pieces` |

## Сессии (сохраняемый прогресс)

| Русский | Код | Коллекция |
|---|---|---|
| Сессия нарезки изоляции | `CuttingSession` | `cutting_sessions` |
| Сессия подсчёта склада | `StockSession` | `stock_sessions` |

## Поля

| Русский | Код |
|---|---|
| Название | `name` |
| Номер чертежа | `drawingNumbers: string[]` |
| Дата ввода в эксплуатацию | `commissionedAt` |
| Активен / в архиве | `isArchived: boolean` |
| Номер последней готовой установки | `lastCompletedUnitNo` |
| … по изоляции | `lastCompletedUnitNoInsulation` |
| … по сборочным узлам | `lastCompletedUnitNoAssembly` |
| Номер установки, с которой пошло в эксплуатацию | `introducedAtUnitNo` |
| Количество на одну единицу | `quantity` |
| Толщина изоляции | `thicknessMm` |
| Клеевой слой | `hasAdhesive: boolean` |
| Геометрия куска | `geometry` |
| Площадь (производная) | `areaMm2` |
| Готов (кусок нарезан) | `isDone` |

## Термины интерфейса

| Русский | Код |
|---|---|
| Сборочная единица (обобщённо) | `Component` — только как UI-обобщение трёх типов |
| Комплект (собираемый из наличия) | `Kit` |
| Излишек / остаток | `Surplus` |
| Отметить всё готовым | `markAllDone` |
| Снять готовность | `clearAllDone` |
| Разархивировать | `unarchive` |

## Чего избегать

- `Installation`, `Refrigerator`, `Fridge`, `Machine` — только `RefrigerationUnit`
- `Node`, `Unit`, `Module` для сборочного узла — только `Assembly`
- `Item`, `Detail`, `Component` для детали — только `Part`
- `Insulation` в одиночку — всегда уточняй: `InsulationSet` / `Group` / `Piece`
- `Unit` без префикса — двусмысленно (установка? единица измерения?). Только `RefrigerationUnit`
  в типах; сокращение `unit` допустимо в переменных внутри явно установочного контекста.
