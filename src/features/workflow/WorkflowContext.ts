import { createContext } from 'react'
import type { AdmissionSnapshot, PaymentRecord, WorkflowState } from './workflowTypes'

export interface WorkflowContextValue extends WorkflowState {
  clearWorkflow: () => void
  setAdmission: (admission: AdmissionSnapshot) => void
  setPayment: (payment: PaymentRecord) => void
}

export const WorkflowContext = createContext<WorkflowContextValue | null>(null)