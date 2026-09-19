import React from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error } as State;
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Puedes extender esto para enviar errores a un servicio de logging
    // console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
          <div className="max-w-2xl w-full bg-white shadow rounded p-6">
            <h2 className="text-lg font-semibold text-red-700">Se produjo un error</h2>
            <p className="mt-2 text-sm text-gray-700">{this.state.error?.message}</p>
            <details className="mt-4 text-xs text-gray-500 whitespace-pre-wrap">
              {this.state.error?.stack}
            </details>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Recargar
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}

