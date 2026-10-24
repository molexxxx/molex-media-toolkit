/**
 * @module components/batch/inspector/PresetSummary
 * The selected jobs' shared preset as one block: the goal it serves, the standard it meets with the levels it sets,
 * what it does, and the technical details folded at its foot. A related setting follows the block only when it
 * applies to the selection.
 */
import type { ReactElement } from 'react'
import type { Operation } from '../../../../../shared/jobs/recipes'
import { presetGuide } from '../../../copy/presetGuides'
import type { FieldPatch, PresetField } from '../../../stores/recipeFields'
import { PresetTipBlock } from '../../presets/PresetGuide'
import { StandardLine, standardSummary } from './StandardLine'

/** Whether the selection shows a preset summary: the jobs share one preset that has a guide. */
export function presetSummarized(field: PresetField | null, op: Operation): boolean
{
  return field !== null && !field.mixed && presetGuide(op, field.value) !== null
}

/** The terms of the levels the summary states. */
export const SUMMARY_TERMS = { loudness: 'Loudness', peak: 'True peak' } as const

/** The note under a standard whose levels the preset fixes. */
export function fixedNote(name: string): string
{
  return `Set by ${name}. Choose Custom in the list to use your own levels.`
}

/** Props for {@link PresetSummary}. */
export interface PresetSummaryProps
{
  op: Operation
  presetId: string
  /** The jobs' shared target when the preset lets it be edited; the preset's own target otherwise. */
  targetLufs?: number | null
  /** Whether the preset's related setting would change any selected job, so it is worth offering. */
  tipApplies: boolean
  /** Applies the related setting to the selected jobs; without it the setting is not offered. */
  onTip?: (patch: FieldPatch, field: string) => void
}

/** The shared preset's goal, standard, and effect in one block; nothing for a user preset. */
export function PresetSummary({ op, presetId, targetLufs = null, tipApplies, onTip }: PresetSummaryProps): ReactElement | null
{
  const guide = presetGuide(op, presetId)
  if (guide === null)
  {
    return null
  }
  const standard = op === 'normalize' ? standardSummary(presetId, targetLufs) : null
  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <section aria-label='About this preset' data-preset-summary={presetId} className='flex min-w-0 flex-col gap-3 rounded-sm border border-line px-3 py-3'>
        <p className='text-body text-ink'>{guide.bestFor}</p>
        {standard !== null && (
          <div className='flex flex-col gap-1' data-preset-standard=''>
            <p className='text-label font-semibold text-ink'>{standard.name}</p>
            <dl className='grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-label'>
              <dt className='text-ink-3'>{SUMMARY_TERMS.loudness}</dt>
              <dd className='text-ink-2 tabular-nums'>{standard.loudness}</dd>
              <dt className='text-ink-3'>{SUMMARY_TERMS.peak}</dt>
              <dd className='text-ink-2 tabular-nums'>{standard.peak}</dd>
            </dl>
            {standard.fixed && <p className='text-label text-ink-3'>{fixedNote(standard.name)}</p>}
          </div>
        )}
        <p className='max-w-[68ch] text-label text-ink-2'>{guide.how}</p>
        {op === 'normalize' && <StandardLine presetId={presetId} targetLufs={targetLufs} />}
      </section>
      {tipApplies && guide.tip !== undefined && onTip !== undefined && <PresetTipBlock tip={guide.tip} onTip={onTip} />}
    </div>
  )
}
