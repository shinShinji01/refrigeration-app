import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_PB_URL)

// SDK по умолчанию отменяет «дублирующиеся» параллельные запросы к одному
// эндпоинту (даже с разными filter/expand) — ломает страницы, где много
// карточек одновременно тянут каждая свой список (assembly_parts на всех
// карточках узлов сразу). Кеш и отмену запросов уже делает RTK Query.
pb.autoCancellation(false)
