/**
 * @module components/presets/PresetGuide
 * @description A built-in preset's guidance, shared by the Batch inspector and Settings: the use in plain words, how
 * it gets there, and a related setting worth changing with it. The goal finder lists common goals per operation,
 * each answered by one preset, for the Settings preset list.
 */
import type { ReactElement } from 'react'
import { operationLabel } from '../../../../shared/jobs/describe'
import { findPreset } from '../../../../shared/jobs/presets'
import type { Operation } from '../../../../shared/jobs/recipes'
import { PRESET_GOALS, presetGuide, type PresetTip } from '../../copy/presetGuides'
import type { FieldPatch } from '../../stores/recipeFields'
import { Button } from '../../ui/Button'
import { cx } from '../../ui/cx'

/** Props for {@link PresetTipBlock}. */
export interface PresetTipBlockProps
{
  tip: PresetTip
  /** Applies the tip's setting; without it the tip shows as text. */
  onTip?: (patch: FieldPatch, field: string) => void
}

/** A related setting worth changing with the preset, with the button that changes it. */
export function PresetTipBlock({ tip, onTip }: PresetTipBlockProps): ReactElement
{
  return (
    <div className='flex flex-col items-start gap-2'>
      <p className='max-w-[68ch] text-label text-ink-2'>{tip.text}</p>
      {tip.action !== undefined && onTip !== undefined && (
        <Button size='sm' variant='secondary' onClick={() => onTip(tip.action!.patch, tip.action!.field)}>{tip.action.label}</Button>
      )}
    </div>
  )
}

/** Props for {@link PresetGuideText}. */
export interface PresetGuideTextProps
{
  op: Operation
  presetId: string
  className?: string
}

/** A built-in preset's guidance as text, or nothing for a user preset. */
export function PresetGuideText({ op, presetId, className }: PresetGuideTextProps): ReactElement | null
{
  const guide = presetGuide(op, presetId)
  if (guide === null)
  {
    return null
  }
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)} data-preset-guide={presetId}>
      <p className='text-body text-ink'>{guide.bestFor}</p>
      <p className='max-w-[68ch] text-label text-ink-2'>{guide.how}</p>
      {guide.tip !== undefined && <PresetTipBlock tip={guide.tip} />}
    </div>
  )
}

/** Props for {@link GoalFinder}. */
export interface GoalFinderProps
{
  op: Operation
  /** The preset in use, whose goal is marked. */
  current: string | null
  onChoose: (presetId: string) => void
  /** `stacked` puts the preset under its goal for a narrow panel; `columns` sets them side by side. */
  layout?: 'stacked' | 'columns'
  className?: string
}

/** The words of the goal finder. */
export const GOAL_WORDS = {
  heading: 'Choose by goal',
  inUse: 'In use'
} as const

/** Common goals for an operation, each a button that chooses its preset; the goal of the preset in use is marked. */
export function GoalFinder({ op, current, onChoose, layout = 'stacked', className }: GoalFinderProps): ReactElement
{
  return (
    <ul aria-label={`${operationLabel(op)} goals`} className={cx('flex flex-col', className)}>
      {PRESET_GOALS[op].map((goal) =>
      {
        const preset = findPreset(goal.presetId)
        const active = goal.presetId === current
        return (
          <li key={goal.goal}>
            <button
              type='button'
              aria-current={active || undefined}
              onClick={() => onChoose(goal.presetId)}
              className={cx(
                'flex w-full min-w-0 rounded-sm px-2 py-1.5 text-start transition-colors duration-fast ease-out hover:bg-wash-hover',
                layout === 'columns' ? 'grid grid-cols-[minmax(0,24rem)_minmax(0,1fr)] items-baseline gap-4' : 'flex-col gap-0.5',
                active && 'bg-wash-selected hover:bg-wash-selected-hover'
              )}
            >
              <span className='text-body text-ink'>{goal.goal}</span>
              <span className={cx('text-label', active ? 'text-accent-ink' : 'text-ink-2')}>
                {preset?.label}
                {active && <span className='sr-only'>{`, ${GOAL_WORDS.inUse}`}</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
