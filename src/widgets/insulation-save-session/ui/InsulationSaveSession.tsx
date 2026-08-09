import { useInsulationSaveSession } from '../model/useInsulationSaveSession'
import styles from './InsulationSaveSession.module.scss'

// Финализация текущей активной сессии нарезки — отдельный блок под
// InsulationGlobalActions (docs/superpowers/specs/2026-08-09-...).
export const InsulationSaveSession = () => {
  const { isReady, isSaving, unitNo, errorMessage, save } = useInsulationSaveSession()

  if (!isReady) return null

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.save}
        aria-disabled={isSaving}
        onClick={isSaving ? undefined : save}
      >
        {isSaving ? 'Сохранение…' : unitNo !== null ? `Сохранить установку №${unitNo}` : 'Сохранить'}
      </button>
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
    </div>
  )
}
