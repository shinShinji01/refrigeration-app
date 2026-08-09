import { z } from 'zod'

// Пустая строка из инпута — «не заполнено», а не невалидное значение
// (docs/spec.md → "Общие моменты": чертёж и дата опциональны).
const emptyToNull = (value: unknown) => (value === '' || value === undefined ? null : value)

const drawingNumberField = z.object({ value: z.string().trim().min(1, 'Введите номер чертежа') })

// Состав (children-picker) — узлы установки или детали узла. linkId — id
// join-записи (null, пока не сохранено); id/name — сама сущность-ребёнок.
// Используется только для установки/узла, но поле есть у всех — деталь просто
// не рендерит и не шлёт непустой массив (см. ComponentEditModal).
const childField = z.object({
  linkId: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  quantity: z.int().positive('Минимум 1'),
})

// Одна схема на все три типа: introducedAtUnitNo и children реально
// используются только у сборочного узла/установки — у остальных просто не
// рендерятся и не шлются (см. ComponentEditModal). Отдельные схемы под
// 90%-совпадающую форму лишние.
export const componentEditSchema = z.object({
  name: z.string().trim().min(1, 'Введите название'),
  drawingNumbers: z.array(drawingNumberField),
  commissionedAt: z.preprocess(emptyToNull, z.string().nullable()),
  introducedAtUnitNo: z.preprocess(
    (value) => (value === '' || value === undefined ? null : Number(value)),
    z.int('Целое число').nonnegative('Не может быть отрицательным').nullable(),
  ),
  children: z.array(childField),
})

export type ComponentEditFormValues = z.output<typeof componentEditSchema>
export type ComponentEditFormInput = z.input<typeof componentEditSchema>
export type ChildFormValue = z.infer<typeof childField>
