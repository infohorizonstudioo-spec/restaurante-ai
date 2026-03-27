'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Component error')
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '200px', color: '#8895A7', fontSize: '14px',
          flexDirection: 'column', gap: '8px',
        }}>
          <p>Algo salió mal. Intenta recargar la página.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '6px 16px', borderRadius: '6px',
              background: '#1A2230', border: '1px solid rgba(255,255,255,0.07)',
              color: '#E8EEF6', cursor: 'pointer', fontSize: '13px',
            }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
