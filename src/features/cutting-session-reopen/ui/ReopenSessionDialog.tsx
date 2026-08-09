import { useState } from 'react'
import { Modal } from '@/shared/ui'
import { useModal } from '@/app/providers'
import { useReopenCuttingSessionMutation } from '@/entities/cutting-session'
import type { CuttingSession } from '@/entities/cutting-session'
import styles from './ReopenSessionDialog.module.scss'

interface ReopenSessionDialogProps {
  session: CuttingSession
  onReopened: (unitNo: number) => void
}

// Открывается из InsulationFilterBar, когда пользователь вручную вводит
// unitNo, для которого уже есть ЗАВЕРШЁННАЯ сессия (docs/superpowers/specs/
// 2026-08-09-insulation-unitno-tracking-design.md). onReopened вместо прямого
// импорта useInsulationSetFilter — та фича сама открывает эту модалку, импорт
// в обратную сторону дал бы цикл между двумя слайсами features/.
export const ReopenSessionDialog = ({ session, onReopened }: ReopenSessionDialogProps) => {
  const { close } = useModal()
  const [reopenSession, { isLoading }] = useReopenCuttingSessionMutation()
  const [error, setError] = useState<string | null>(null)

  const handleReopen = async (resetDonePieces: boolean) => {
    setError(null)
    try {
      await reopenSession({
        sessionId: session.id,
        unitId: session.unit,
        setId: session.set,
        resetDonePieces,
      }).unwrap()
      onReopened(session.unitNo)
      close()
    } catch {
      setError('Не удалось выполнить действие. Попробуйте ещё раз.')
    }
  }

  return (
    <Modal title={`Установка №${session.unitNo} уже завершена по изоляции`} onClose={close}>
      <p className={styles.description}>
        Начать заново — сбросить отметки готовности и резать с чистого листа.
        Редактировать — открыть как есть, отметки останутся такими же, как на
        момент завершения.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.restart}
          disabled={isLoading}
          onClick={() => handleReopen(true)}
        >
          Начать заново
        </button>
        <button type="button" className={styles.edit} disabled={isLoading} onClick={() => handleReopen(false)}>
          Редактировать
        </button>
        <button type="button" className={styles.cancel} disabled={isLoading} onClick={close}>
          Отмена
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
    </Modal>
  )
}
