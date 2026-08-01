# Настройка окружения

Порядок на вечер. Пункты 1–5 сделай сам, дальше можно передавать Claude Code.

## 1. Скелет проекта

```bash
pnpm create vite refrigeration-app --template react-ts
cd refrigeration-app
git init && git add -A && git commit -m "начальный коммит vite"
```

Затем распакуй сюда содержимое скаффолда (`CLAUDE.md`, `.claude/`, `docs/`, `src/`-дерево).
`docs/spec.md` — вставь туда своё ТЗ целиком, файл-заглушка уже лежит.

## 2. Зависимости

```bash
pnpm add react-router @reduxjs/toolkit react-redux pocketbase \
  @radix-ui/react-dialog @radix-ui/react-accordion @radix-ui/react-checkbox \
  downshift @floating-ui/react react-hook-form zod @hookform/resolvers \
  @tanstack/react-virtual date-fns clsx

pnpm add -D sass vite-plugin-svgr vitest @testing-library/react \
  @testing-library/user-event @testing-library/jest-dom jsdom msw \
  eslint stylelint stylelint-config-standard-scss prettier \
  @types/node
```

## 3. Строгий TypeScript

В `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

Алиас `@/` продублируй в `vite.config.ts` (`resolve.alias`) и в `vitest` конфиге.

## 4. Скрипты в package.json

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . && stylelint \"src/**/*.scss\"",
    "test": "vitest run",
    "check": "pnpm typecheck && pnpm lint && pnpm test",
    "pb": ".pocketbase\\pocketbase.exe serve"
  }
}
```

`pnpm check` — то, чем Claude Code проверяет сам себя. Без него он приносит код,
который не собирается.

## 5. PocketBase

Скачай бинарник под свою ОС с pocketbase.io, положи в `./.pocketbase/`.
Добавь в `.gitignore`: `.pocketbase/pb_data/`, `.pocketbase/pocketbase`, `.pocketbase/pocketbase.exe`.

```bash
pnpm pb
```

Открой `http://127.0.0.1:8090/_/`, создай админа. Коллекции по
`docs/data-model.md` — можно попросить Claude Code сгенерировать миграции
(`pb_migrations/`), но схему сначала прощёлкай в админке руками: так быстрее увидишь,
что модель рабочая.

## 6. MCP

```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest
claude mcp add context7 -- npx -y @upstash/context7-mcp
```

Playwright — чтобы я мог сам открыть приложение, кликать и чинить вёрстку по скриншотам.
Для UI-тяжёлого проекта это самая полезная вещь из всего списка.

Проверить: `claude mcp list`.

## 7. Расширения VSCode

ESLint, Prettier, Stylelint, Error Lens, GitLens, Claude Code.

В `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## 8. Реальные данные

Подготовь 2–3 настоящие установки со всем составом: узлы, детали, группы изоляции,
куски с размерами. Положи в `docs/sample-data.md` в любом виде — хоть таблицей,
хоть текстом.

Это важнее, чем кажется. Из них станет ясно: сколько деталей в узле (5 или 200 —
от этого зависит виртуализация), какие бывают формы кусков, сколько версий изоляции
реально накапливается. Без этого я буду проектировать под выдуманные объёмы.

Фото или скриншоты того, чем ты пользуешься сейчас (excel, бумажные формы) — туда же.
Лучший источник понимания реального процесса.

## 9. Первая сессия с Claude Code

```bash
claude
```

Начни с: «прочитай CLAUDE.md и docs/, задай вопросы по неясным местам, потом предложи
план первого этапа». Не проси сразу писать код.
