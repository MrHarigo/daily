'use client'

import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
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
  }

  render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || 'Something went wrong'

      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
          <div className="text-red-600 dark:text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-2">
            {title}
          </h2>
          <p className="text-red-700 dark:text-red-300 mb-4 text-center max-w-md">
            An error occurred while rendering this section. You can try reloading it or check the console for more details.
          </p>
          {this.state.error && (
            <details className="mb-4 text-sm text-red-800 dark:text-red-200 max-w-lg">
              <summary className="cursor-pointer font-medium mb-2">Error details</summary>
              <pre className="bg-red-100 dark:bg-red-900/20 p-3 rounded overflow-auto">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
