import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { T, mono, sora } from './data'
import { Btn, Card } from './ui-primitives'

type Props = {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100%' }}>
          <Card style={{ maxWidth: 480, padding: 24, display: 'grid', gap: 16, border: `1px solid ${T.danger}40`, background: `${T.danger}08` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertTriangle size={24} color={T.danger} />
              <div style={{ ...sora, fontSize: 18, fontWeight: 700, color: T.text }}>Something went wrong</div>
            </div>
            <div style={{ ...mono, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
              A component crashed while rendering. The error has been logged.
            </div>
            {this.state.error && (
              <div style={{ ...mono, fontSize: 10, color: T.danger, background: `${T.danger}10`, padding: 12, borderRadius: 8, overflowX: 'auto' }}>
                {this.state.error.message}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn onClick={this.handleReset}>Try Again</Btn>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
