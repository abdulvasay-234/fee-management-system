import { use } from 'react'
import { WorkflowContext } from './WorkflowContext'

export function useWorkflow() {
  const context = use(WorkflowContext)

  if (!context) {
    throw new Error('useWorkflow must be used within WorkflowProvider')
  }

  return context
}