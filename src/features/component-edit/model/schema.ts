import { z } from 'zod'

// Пустая строка из инпута — «не заполнено», а не невалидное значение
// (docs/spec.md → "Общие моменты": чертёж и дата опциональны).
const emptyToNull = (value: unknown) => (value === '' || value === undefined ? null : value)

const drawingNumberField = z.object({ value: z.string().trim().min(1, 'Введите номер чертежа') })

// Одна схема на все три типа: introducedAtUnitNo реально используется только
// у сборочного узла, у установки/детали поле просто не рендерится и не шлётся
// (см. ComponentEditModal) — отдельные схемы под 90%-совпадающую форму лишние.
export const componentEditSchema = z.object({
  name: z.string().trim().min(1, 'Введите название'),
  drawingNumbers: z.array(drawingNumberField),
  commissionedAt: z.preprocess(emptyToNull, z.string().nullable()),
  introducedAtUnitNo: z.preprocess(
    (value) => (value === '' || value === undefined ? null : Number(value)),
    z.int('Целое число').nonnegative('Не может быть отрицательным').nullable(),
  ),
})

export type ComponentEditFormValues = z.infer<typeof componentEditSchema>
