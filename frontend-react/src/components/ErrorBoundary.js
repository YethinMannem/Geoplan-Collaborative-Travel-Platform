import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          padding: '40px',
          background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            maxWidth: '600px'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>⚠️</div>
            <h1 style={{ 
              fontSize: '1.75rem', 
              fontWeight: '800', 
              color: '#000000',
              marginBottom: '16px'
            }}>
              Something Went Wrong
            </h1>
            <p style={{ 
              fontSize: '1rem', 
              color: '#000000',
              marginBottom: '24px',
              lineHeight: '1.6'
            }}>
              An error occurred while loading the application.
            </p>
            <button
              onClick={() => {
                window.location.reload();
              }}
              style={{
                padding: '14px 28px',
                fontSize: '1rem',
                fontWeight: '800',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
              }}
            >
              Reload Page
            </button>
            {this.state.error && (
              <details style={{
                marginTop: '20px',
                padding: '16px',
                background: '#f3f4f6',
                borderRadius: '8px',
                textAlign: 'left',
                fontSize: '0.875rem',
                color: '#000000'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: '700', marginBottom: '8px' }}>
                  Error Details
                </summary>
                <pre style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '0.75rem',
                  color: '#6b7280'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;



