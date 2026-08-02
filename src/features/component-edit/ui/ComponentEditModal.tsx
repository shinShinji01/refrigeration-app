import { useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query/react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal, IconButton } from '@/shared/ui'
import DeleteIcon from '@/shared/assets/icons/delete.svg?react'
import { useModal } from '@/app/providers'
import type { ComponentListItem } from '@/features/cascade-filter'
import { ChildrenPickerField, diffChildren, type ChildPickerItem } from '@/features/children-picker'
import { useUpdateUnitMutation } from '@/entities/refrigeration-unit'
import type { AssemblyId } from '@/entities/assembly'
import {
  useUpdateAssemblyMutation,
  useGetAssembliesQuery,
  useGetAssembliesForUnitQuery,
  useAddAssemblyToUnitMutation,
  useUpdateUnitAssemblyQuantityMutation,
  useRemoveAssemblyFromUnitMutation,
} from '@/entities/assembly'
import type { PartId } from '@/entities/part'
import {
  useUpdatePartMutation,
  useGetPartsQuery,
  useGetPartsForAssemblyQuery,
  useAddPartToAssemblyMutation,
  useUpdateAssemblyPartQuantityMutation,
  useRemovePartFromAssemblyMutation,
} from '@/entities/part'
import { componentEditSchema, type ComponentEditFormValues, type ChildFormValue } from '../model/schema'
import styles from './ComponentEditModal.module.scss'

interface ComponentEditModalProps {
  item: ComponentListItem
}

const TITLE_BY_KIND: Record<ComponentListItem['kind'], string> = {
  unit: 'Редактировать установку',
  assembly: 'Редактировать узел',
  part: 'Редактировать деталь',
}

// Дата хранится в PocketBase как datetime-строка — для <input type="date">
// нужны первые 10 символов (YYYY-MM-DD), пустая строка означает «не заполнено».
const toDateInputValue = (value: string | null): string => (value ? value.slice(0, 10) : '')

const toDefaultValues = (
  item: ComponentListItem,
  unitAssemblies: { linkId: string; id: string; name: string; quantity: number }[] | undefined,
  assemblyParts: { linkId: string; id: string; name: string; quantity: number }[] | undefined,
): ComponentEditFormValues => {
  const entity = item.kind === 'unit' ? item.unit : item.kind === 'assembly' ? item.assembly : item.part
  const children: ChildFormValue[] =
    item.kind === 'unit'
      ? (unitAssemblies ?? []).map((assembly) => ({ ...assembly }))
      : item.kind === 'assembly'
        ? (assemblyParts ?? []).map((part) => ({ ...part }))
        : []

  return {
    name: entity.name,
    drawingNumbers: entity.drawingNumbers.map((value) => ({ value })),
    commissionedAt: toDateInputValue(entity.commissionedAt),
    introducedAtUnitNo: item.kind === 'assembly' ? item.assembly.introducedAtUnitNo : null,
    children,
  }
}

// Форма общая для всех трёх типов. introducedAtUnitNo — только для узла,
// children (children-picker) — для установки (узлы) и узла (детали); у детали
// ни того, ни другого не рендерится и не шлётся при сохранении.
export const ComponentEditModal = ({ item }: ComponentEditModalProps) => {
  const { close } = useModal()
  const [saveError, setSaveError] = useState<string | null>(null)

  const [updateUnit] = useUpdateUnitMutation()
  const [updateAssembly] = useUpdateAssemblyMutation()
  const [updatePart] = useUpdatePartMutation()
  const [addAssemblyToUnit] = useAddAssemblyToUnitMutation()
  const [updateUnitAssemblyQuantity] = useUpdateUnitAssemblyQuantityMutation()
  const [removeAssemblyFromUnit] = useRemoveAssemblyFromUnitMutation()
  const [addPartToAssembly] = useAddPartToAssemblyMutation()
  const [updateAssemblyPartQuantity] = useUpdateAssemblyPartQuantityMutation()
  const [removePartFromAssembly] = useRemovePartFromAssemblyMutation()

  const isUnit = item.kind === 'unit'
  const isAssembly = item.kind === 'assembly'

  const assemblyCandidates = useGetAssembliesQuery(isUnit ? { includeArchived: false } : skipToken)
  const unitAssemblies = useGetAssembliesForUnitQuery(isUnit ? item.unit.id : skipToken)
  const partCandidates = useGetPartsQuery(isAssembly ? { includeArchived: false } : skipToken)
  const assemblyParts = useGetPartsForAssemblyQuery(isAssembly ? item.assembly.id : skipToken)

  // Снимок на момент открытия — и как defaultValues формы, и как база для
  // diffChildren при сохранении. Один и тот же source of truth (см. вариант A
  // при планировании: карточка уже несёт нужные данные, лишний перезапрос не нужен).
  const [initialValues] = useState<ComponentEditFormValues>(() =>
    toDefaultValues(item, unitAssemblies.data, assemblyParts.data),
  )

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ComponentEditFormValues>({
    resolver: zodResolver(componentEditSchema),
    defaultValues: initialValues,
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'drawingNumbers' })
  const {
    fields: childFields,
    append: appendChild,
    remove: removeChild,
    update: updateChild,
  } = useFieldArray({ control, name: 'children', keyName: 'fieldId' })

  const addedIds = new Set(childFields.map((field) => field.id))
  const candidateSource = isUnit ? assemblyCandidates.data : isAssembly ? partCandidates.data : undefined
  const candidates = (candidateSource ?? [])
    .filter((candidate) => !addedIds.has(candidate.id))
    .map((candidate) => ({ id: candidate.id, name: candidate.name }))

  const childItems: ChildPickerItem[] = childFields.map((field) => ({
    key: field.fieldId,
    id: field.id,
    name: field.name,
    quantity: field.quantity,
  }))

  const handleAddChild = (candidate: { id: string; name: string }) => {
    appendChild({ linkId: null, id: candidate.id, name: candidate.name, quantity: 1 })
  }

  const handleRemoveChild = (key: string) => {
    const index = childFields.findIndex((field) => field.fieldId === key)
    if (index !== -1) removeChild(index)
  }

  const handleChildQuantityChange = (key: string, quantity: number) => {
    const index = childFields.findIndex((field) => field.fieldId === key)
    if (index === -1) return
    const current = childFields[index]
    updateChild(index, { linkId: current.linkId, id: current.id, name: current.name, quantity })
  }

  const onSubmit = async (values: ComponentEditFormValues) => {
    setSaveError(null)
    const drawingNumbers = values.drawingNumbers.map((field) => field.value)

    try {
      if (item.kind === 'unit') {
        await updateUnit({
          id: item.unit.id,
          name: values.name,
          drawingNumbers,
          commissionedAt: values.commissionedAt,
        }).unwrap()

        const diff = diffChildren(initialValues.children, values.children)
        await Promise.all([
          ...diff.toCreate.map((entry) =>
            addAssemblyToUnit({
              unitId: item.unit.id,
              assemblyId: entry.id as AssemblyId,
              quantity: entry.quantity,
            }).unwrap(),
          ),
          ...diff.toUpdate.map((entry) =>
            updateUnitAssemblyQuantity({
              unitId: item.unit.id,
              linkId: entry.linkId,
              quantity: entry.quantity,
            }).unwrap(),
          ),
          ...diff.toDelete.map((linkId) => removeAssemblyFromUnit({ unitId: item.unit.id, linkId }).unwrap()),
        ])
      } else if (item.kind === 'assembly') {
        await updateAssembly({
          id: item.assembly.id,
          name: values.name,
          drawingNumbers,
          commissionedAt: values.commissionedAt,
          introducedAtUnitNo: values.introducedAtUnitNo,
        }).unwrap()

        const diff = diffChildren(initialValues.children, values.children)
        await Promise.all([
          ...diff.toCreate.map((entry) =>
            addPartToAssembly({
              assemblyId: item.assembly.id,
              partId: entry.id as PartId,
              quantity: entry.quantity,
            }).unwrap(),
          ),
          ...diff.toUpdate.map((entry) =>
            updateAssemblyPartQuantity({
              assemblyId: item.assembly.id,
              linkId: entry.linkId,
              quantity: entry.quantity,
            }).unwrap(),
          ),
          ...diff.toDelete.map((linkId) =>
            removePartFromAssembly({ assemblyId: item.assembly.id, linkId }).unwrap(),
          ),
        ])
      } else {
        await updatePart({
          id: item.part.id,
          name: values.name,
          drawingNumbers,
          commissionedAt: values.commissionedAt,
        }).unwrap()
      }
      close()
    } catch {
      setSaveError('Не удалось сохранить. Попробуйте ещё раз.')
    }
  }

  return (
    <Modal title={TITLE_BY_KIND[item.kind]} onClose={close}>
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <label className={styles.field}>
          <span className={styles.label}>Название</span>
          <input className={styles.input} {...register('name')} />
          {errors.name ? <span className={styles.error}>{errors.name.message}</span> : null}
        </label>

        <div className={styles.field}>
          <span className={styles.label}>Номера чертежей</span>
          <div className={styles.drawingList}>
            {fields.map((field, index) => (
              <div className={styles.drawingRow} key={field.id}>
                <input className={styles.input} {...register(`drawingNumbers.${index}.value`)} />
                <IconButton
                  icon={DeleteIcon}
                  label="Удалить номер чертежа"
                  className={styles.removeDrawing}
                  onClick={() => remove(index)}
                />
              </div>
            ))}
          </div>
          {errors.drawingNumbers ? (
            <span className={styles.error}>Заполните номер или удалите строку</span>
          ) : null}
          <button type="button" className={styles.addDrawing} onClick={() => append({ value: '' })}>
            + Добавить чертёж
          </button>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Дата ввода в эксплуатацию</span>
          <input className={styles.input} type="date" {...register('commissionedAt')} />
        </label>

        {item.kind === 'assembly' ? (
          <label className={styles.field}>
            <span className={styles.label}>Номер установки, с которого пошёл в эксплуатацию</span>
            <input className={styles.input} type="number" min={0} step={1} {...register('introducedAtUnitNo')} />
            {errors.introducedAtUnitNo ? (
              <span className={styles.error}>{errors.introducedAtUnitNo.message}</span>
            ) : null}
          </label>
        ) : null}

        {isUnit ? (
          <ChildrenPickerField
            label="Сборочные узлы"
            addedItems={childItems}
            candidates={candidates}
            onAdd={handleAddChild}
            onRemove={handleRemoveChild}
            onQuantityChange={handleChildQuantityChange}
            searchPlaceholder="Найти сборочный узел"
          />
        ) : null}

        {isAssembly ? (
          <ChildrenPickerField
            label="Детали"
            addedItems={childItems}
            candidates={candidates}
            onAdd={handleAddChild}
            onRemove={handleRemoveChild}
            onQuantityChange={handleChildQuantityChange}
            searchPlaceholder="Найти деталь"
          />
        ) : null}

        {saveError ? <p className={styles.error}>{saveError}</p> : null}

        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={close}>
            Отмена
          </button>
          <button type="submit" className={styles.save} disabled={isSubmitting}>
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  )
}
