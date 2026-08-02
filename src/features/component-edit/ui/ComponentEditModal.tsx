import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal, IconButton } from '@/shared/ui'
import DeleteIcon from '@/shared/assets/icons/delete.svg?react'
import { useModal } from '@/app/providers'
import type { ComponentListItem } from '@/features/cascade-filter'
import { useUpdateUnitMutation } from '@/entities/refrigeration-unit'
import { useUpdateAssemblyMutation } from '@/entities/assembly'
import { useUpdatePartMutation } from '@/entities/part'
import { componentEditSchema, type ComponentEditFormValues } from '../model/schema'
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

const toDefaultValues = (item: ComponentListItem): ComponentEditFormValues => {
  const entity = item.kind === 'unit' ? item.unit : item.kind === 'assembly' ? item.assembly : item.part
  return {
    name: entity.name,
    drawingNumbers: entity.drawingNumbers.map((value) => ({ value })),
    commissionedAt: toDateInputValue(entity.commissionedAt),
    introducedAtUnitNo: item.kind === 'assembly' ? item.assembly.introducedAtUnitNo : null,
  }
}

// Форма общая для всех трёх типов (name/drawingNumbers/commissionedAt) —
// introducedAtUnitNo реально используется и шлётся только для узла
// (docs/component-edit — блок добавления дочерних элементов сюда не входит,
// это отдельная фича children-picker).
export const ComponentEditModal = ({ item }: ComponentEditModalProps) => {
  const { close } = useModal()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [updateUnit] = useUpdateUnitMutation()
  const [updateAssembly] = useUpdateAssemblyMutation()
  const [updatePart] = useUpdatePartMutation()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ComponentEditFormValues>({
    resolver: zodResolver(componentEditSchema),
    defaultValues: toDefaultValues(item),
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'drawingNumbers' })

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
      } else if (item.kind === 'assembly') {
        await updateAssembly({
          id: item.assembly.id,
          name: values.name,
          drawingNumbers,
          commissionedAt: values.commissionedAt,
          introducedAtUnitNo: values.introducedAtUnitNo,
        }).unwrap()
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
