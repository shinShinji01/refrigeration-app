// Значение в cutting_sessions.donePieces — число (сколько единиц куска
// отрезано) для новых записей, либо легаси true (записи до введения
// частичного прогресса, docs/superpowers/specs/2026-08-11-...) — трактуется
// как "полностью готово". Миграция данных не нужна: перезаписывается числом
// при первом же изменении этого куска.
export const resolveDoneCount = (raw: number | true | undefined, quantity: number): number =>
  raw === true ? quantity : (raw ?? 0)
