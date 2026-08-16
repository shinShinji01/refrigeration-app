import type { SegmentLabel } from '../lib/segmentLabel'
import styles from './ShapeEditor.module.scss'

interface SideLengthLabelProps {
  label: SegmentLabel
  fontSizeMm: number
  testId: string
}

export const SideLengthLabel = ({ label, fontSizeMm, testId }: SideLengthLabelProps) => (
  <text
    data-testid={testId}
    className={styles.sideLabel}
    x={label.labelPosition.x}
    y={label.labelPosition.y}
    transform={`rotate(${label.angleDeg} ${label.labelPosition.x} ${label.labelPosition.y})`}
    fontSize={fontSizeMm}
  >
    {Math.round(label.lengthMm)}мм
  </text>
)
