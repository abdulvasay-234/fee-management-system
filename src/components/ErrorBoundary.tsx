import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card } from './ui'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  retryKey: number
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, retryKey: 0 }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled application render error.', error, info)
  }

  retry = () => {
    this.setState((state) => ({ hasError: false, retryKey: state.retryKey + 1 }))
  }

  goToDashboard = () => {
    window.location.hash = '#/'
    this.retry()
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-boundary">
          <Card className="app-error-boundary__card">
            <span>LSA Fee Management</span>
            <h1>Something went wrong</h1>
            <p>An unexpected error occurred while loading this page.</p>
            <div>
              <Button onClick={this.retry}>Try Again</Button>
              <Button variant="secondary" onClick={this.goToDashboard}>Go to Dashboard</Button>
            </div>
          </Card>
        </main>
      )
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>
  }
}