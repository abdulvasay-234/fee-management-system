import { useState, type ReactNode } from 'react'
import { WorkflowContext } from './WorkflowContext'
import type { AdmissionSnapshot, PaymentRecord, WorkflowState } from './workflowTypes'

const initialState: WorkflowState = {
  admission: null,
  payment: null,
}

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState)

  function setAdmission(admission: AdmissionSnapshot) {
    setState({ admission, payment: null })
  }

  function setPayment(payment: PaymentRecord) {
    setState((current) => ({ ...current, payment }))
  }

  function clearWorkflow() {
    setState(initialState)
  }

  return (
    <WorkflowContext value={{ ...state, clearWorkflow, setAdmission, setPayment }}>
      {children}
    </WorkflowContext>
  )
}