import { expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { createBrief, projectWithShoots } from '../model/brief'
import { countBriefImages } from '../model/image-count'
import { formatBriefingDate, ShootTimes } from './shoot-times'

it('formats briefing dates as day, month and year', () => {
  expect(formatBriefingDate('2026-05-16', 'en')).toBe('16. May 2026')
  expect(formatBriefingDate('2026-05-16', 'nb')).toBe('16. mai 2026')
})

it('stacks the briefing date, time bullets with a full count each, and the total over all times', () => {
  const brief = createBrief({ name: 'Shoot', clientName: 'Client', date: '2026-05-16', times: ['09:00'] })
  brief.project = projectWithShoots(brief.project, [
    { date: '2026-05-16', time: '09:00' },
    { date: '2026-05-16', time: '14:00', endTime: '16:00' },
  ])
  brief.angles = [{ id: 'p', label: 'Panorama', type: '360', position: brief.coordinates }]
  const perTime = countBriefImages(brief).total
  expect(perTime).toBeGreaterThan(0)
  render(<ShootTimes brief={brief} layout="stack" language="en" />)
  expect(screen.getByText('Shoot times')).toBeVisible()
  expect(screen.getByText('16. May 2026')).toBeVisible()
  const times = screen.getByText('16. May 2026').parentElement?.querySelector('ul')
  expect(times).toBeTruthy()
  expect(within(times!).getByText('09:00')).toBeVisible()
  expect(within(times!).getByText('14:00 - 16:00')).toBeVisible()
  expect(screen.getByText('Total images')).toBeVisible()
  expect(within(times!).getAllByText(`${perTime} images`)).toHaveLength(2)
  expect(screen.getByLabelText('Total images')).toHaveTextContent(String(perTime * 2))
  expect(screen.getByLabelText('Total images').previousElementSibling).toHaveTextContent('Total images')
})
