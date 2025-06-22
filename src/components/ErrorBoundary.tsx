import React, { Component, ReactNode } from 'react';
import { AlertTriangleIcon, RefreshCwIcon, ChevronLeftIcon } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  showRetry?: boolean;
  showNavigation?: boolean;
  onRetry?: () => void;
  onNavigate?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      const {
        fallbackTitle = 'Something went wrong',
        fallbackMessage = 'An unexpected error occurred. Please try again or navigate to a different step.',
        showRetry = true,
        showNavigation = true,
        onNavigate
      } = this.props;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-center max-w-md">
            <AlertTriangleIcon size={48} className="mx-auto mb-4 text-red-500" />
            
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              {fallbackTitle}
            </h3>
            
            <p className="text-red-700 mb-6 text-sm leading-relaxed">
              {fallbackMessage}
            </p>

            {/* Error details for development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-red-600 font-medium mb-2">
                  Error Details (Development)
                </summary>
                <div className="bg-red-100 p-3 rounded border text-xs font-mono text-red-800 overflow-auto max-h-32">
                  <div className="mb-2">
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="whitespace-pre-wrap mt-1">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {showRetry && (
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <RefreshCwIcon size={16} className="mr-2" />
                  Try Again
                </button>
              )}
              
              {showNavigation && onNavigate && (
                <button
                  onClick={onNavigate}
                  className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeftIcon size={16} className="mr-2" />
                  Go Back
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundaries for different contexts

export const PDFProcessingErrorBoundary: React.FC<{
  children: ReactNode;
  onRetry?: () => void;
  onNavigate?: () => void;
}> = ({ children, onRetry, onNavigate }) => (
  <ErrorBoundary
    fallbackTitle="PDF Processing Error"
    fallbackMessage="There was an error processing your PDF file. This could be due to a corrupted file, unsupported PDF format, or insufficient memory. Please try a different PDF file or refresh the page."
    onRetry={onRetry}
    onNavigate={onNavigate}
  >
    {children}
  </ErrorBoundary>
);

export const CardProcessingErrorBoundary: React.FC<{
  children: ReactNode;
  onRetry?: () => void;
  onNavigate?: () => void;
}> = ({ children, onRetry, onNavigate }) => (
  <ErrorBoundary
    fallbackTitle="Card Processing Error"
    fallbackMessage="There was an error processing card images. This could be due to invalid extraction settings, memory limitations, or corrupted card data. Please check your settings and try again."
    onRetry={onRetry}
    onNavigate={onNavigate}
  >
    {children}
  </ErrorBoundary>
);

export const RenderingErrorBoundary: React.FC<{
  children: ReactNode;
  onRetry?: () => void;
  onNavigate?: () => void;
}> = ({ children, onRetry, onNavigate }) => (
  <ErrorBoundary
    fallbackTitle="Rendering Error"
    fallbackMessage="There was an error rendering the preview or generating output. This could be due to invalid dimensions, canvas limitations, or processing errors. Please check your configuration settings."
    onRetry={onRetry}
    onNavigate={onNavigate}
  >
    {children}
  </ErrorBoundary>
);

export const ExportErrorBoundary: React.FC<{
  children: ReactNode;
  onRetry?: () => void;
  onNavigate?: () => void;
}> = ({ children, onRetry, onNavigate }) => (
  <ErrorBoundary
    fallbackTitle="Export Error"
    fallbackMessage="There was an error generating your PDF files. This could be due to memory limitations, invalid settings, or processing errors. Please check your output settings and try again."
    onRetry={onRetry}
    onNavigate={onNavigate}
  >
    {children}
  </ErrorBoundary>
);