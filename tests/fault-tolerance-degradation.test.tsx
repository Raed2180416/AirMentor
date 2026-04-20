// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ErrorBoundary } from '../src/error-boundary'

const BuggyComponent = ({ shouldCrash }: { shouldCrash: boolean }) => {
  if (shouldCrash) {
    throw new Error('Simulated crash')
  }
  return <div>Normal Render</div>
}

describe('Fault Tolerance and Degradation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
  })

  it('P12-C01: Frontend error containment prevents global shell collapse for local faults', async () => {
    const { rerender } = render(
      <ErrorBoundary>
        <BuggyComponent shouldCrash={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Normal Render')).toBeTruthy()

    rerender(
      <ErrorBoundary>
        <BuggyComponent shouldCrash={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('Simulated crash')).toBeTruthy()
  })

  it('P12-C07: Manual recovery guidance exists for non-recoverable user-facing failures', async () => {
    const handleReset = vi.fn()
    render(
      <ErrorBoundary onReset={handleReset}>
        <BuggyComponent shouldCrash={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeTruthy()
    
    const tryAgainButton = screen.getByText('Try Again')
    fireEvent.click(tryAgainButton)

    expect(handleReset).toHaveBeenCalled()
  })
})
