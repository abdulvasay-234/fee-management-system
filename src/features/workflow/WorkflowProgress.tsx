import { ArrowRight } from 'lucide-react'

type WorkflowStep = 'admission' | 'payment' | 'receipt'

const steps: Array<{ id: WorkflowStep; label: string; number: string }> = [
  { id: 'admission', label: 'Admission', number: '01' },
  { id: 'payment', label: 'Fee Payment', number: '02' },
  { id: 'receipt', label: 'Receipt', number: '03' },
]

export function WorkflowProgress({ current }: { current: WorkflowStep }) {
  const currentIndex = steps.findIndex((step) => step.id === current)

  return (
    <nav className="workflow-progress" aria-label="Admission workflow progress">
      {steps.map((step, index) => (
        <div className="workflow-progress__group" key={step.id}>
          <div
            className={`workflow-progress__step${index === currentIndex ? ' workflow-progress__step--active' : ''}${index < currentIndex ? ' workflow-progress__step--complete' : ''}`}
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            <span>{step.number}</span>
            {step.label}
          </div>
          {index < steps.length - 1 && (
            <ArrowRight className="workflow-progress__arrow" aria-hidden="true" size={15} />
          )}
        </div>
      ))}
    </nav>
  )
}