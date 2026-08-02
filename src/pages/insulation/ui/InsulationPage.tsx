import { skipToken } from '@reduxjs/toolkit/query/react'
import { useInsulationSetFilter, InsulationFilterBar } from '@/features/insulation-set-filter'
import { useGetGroupsForSetQuery } from '@/entities/insulation-group'
import { InsulationGroupList } from '@/widgets/insulation-group-list'
import { EmptyState } from '@/shared/ui'
import styles from './InsulationPage.module.scss'

export const InsulationPage = () => {
  const { unitId, selectedSetId } = useInsulationSetFilter()
  // currentData (не data) и isFetching (не isLoading) — иначе на смене версии
  // набора один рендер отдаёт группы СТАРОЙ версии при уже новом selectedSetId
  // (RTK Query отдаёт data от предыдущего arg, пока грузится новый), и именно
  // в этот рендер из-за key={selectedSetId} монтируется свежий Accordion —
  // получая в defaultValue чужие linkId. currentData/isFetching гарантируют,
  // что список не рендерится, пока данные не соответствуют текущей версии.
  const { currentData: groups = [], isFetching } = useGetGroupsForSetQuery(selectedSetId ?? skipToken)

  return (
    <div className={styles.root}>
      <h1>Изоляция и раскрой</h1>
      <InsulationFilterBar />
      {!unitId ? (
        <EmptyState message="Выберите установку" />
      ) : !selectedSetId ? (
        <EmptyState message="У установки нет набора изоляции" />
      ) : (
        // key — при смене версии набора список групп (и их linkId, по которым
        // Accordion помнит развёрнутые пункты) полностью меняется; без key
        // React переиспользовал бы тот же компонент, и всё оказывалось бы
        // свёрнутым, т.к. старые linkId не совпадают с новыми.
        <InsulationGroupList key={selectedSetId} groups={groups} isLoading={isFetching} />
      )}
    </div>
  )
}
