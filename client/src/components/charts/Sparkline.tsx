import { useId } from 'react'

import { cn } from '@/lib/cn'

export interface SparklineProps {
  data: number[]
  className?: string
  stroke?: string
  /** Fill colour for the area under the line. Defaults to a translucent stroke. */
  fill?: string
  /** Stroke width in pixels. */
  strokeWidth?: number
}

/**
 * Dependency-free SVG sparkline. Used for compact trend indicators inside
 * metric tiles, where a full chart would be overkill.
 */
export function Sparkline({
  data,
  className,
  stroke = 'var(--color-brand)',
  fill,
  strokeWidth = 2,
}: SparklineProps) {
  const gradientId = useId()

  if (data.length < 2) {
    return <div className={cn('h-10 w-24', className)} aria-hidden="true" />
  }

  const width = 100
  const height = 32
  const padding = 2

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((value - min) / range) * (height - padding * 2)
    return { x, y }
  })

  const line = points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`
      const previous = points[index - 1]!
      const controlX = (previous.x + point.x) / 2
      return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`
    })
    .join(' ')

  const first = points[0]!
  const last = points[points.length - 1]!
  const area = `${line} L ${last.x} ${height} L ${first.x} ${height} Z`
  const resolvedFill = fill ?? stroke

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('h-10 w-full', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={resolvedFill} stopOpacity="0.28" />
          <stop offset="100%" stopColor={resolvedFill} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
