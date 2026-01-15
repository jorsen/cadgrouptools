'use client';

import React, { Component, ReactNode } from 'react';
import { Result, Button, Typography, Collapse } from 'antd';
import { BugOutlined, ReloadOutlined, HomeOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;
const { Panel } = Collapse;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
  errorId: string | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // Generate error ID
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Log to console
    console.error('Error Boundary caught an error:', {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    });

    // Update state with error details
    this.setState({
      error,
      errorInfo,
      errorId,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, errorId } = this.state;

      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div style={{ 
          minHeight: '100vh', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '24px',
        }}>
          <Result
            status="error"
            icon={<BugOutlined style={{ fontSize: 72 }} />}
            title="Oops! Something went wrong"
            subTitle={
              <div>
                <Paragraph>
                  We're sorry, but something unexpected happened. The error has been 
                  automatically reported to our team.
                </Paragraph>
                {errorId && (
                  <Paragraph>
                    <Text type="secondary">Error ID: {errorId}</Text>
                  </Paragraph>
                )}
              </div>
            }
            extra={[
              <Button 
                key="reload" 
                type="primary" 
                icon={<ReloadOutlined />}
                onClick={this.handleReload}
              >
                Reload Page
              </Button>,
              <Button 
                key="home" 
                icon={<HomeOutlined />}
                onClick={this.handleGoHome}
              >
                Go to Dashboard
              </Button>,
              <Button 
                key="retry" 
                onClick={this.handleReset}
              >
                Try Again
              </Button>,
            ]}
          >
            {process.env.NODE_ENV === 'development' && error && (
              <Collapse 
                ghost 
                style={{ marginTop: 24, textAlign: 'left' }}
              >
                <Panel 
                  header="Error Details (Development Only)" 
                  key="1"
                  style={{ backgroundColor: '#f5f5f5' }}
                >
                  <Paragraph>
                    <Text strong>Error Message:</Text>
                    <br />
                    <Text code>{error.message}</Text>
                  </Paragraph>
                  
                  {error.stack && (
                    <Paragraph>
                      <Text strong>Stack Trace:</Text>
                      <pre style={{ 
                        fontSize: 12, 
                        overflow: 'auto',
                        backgroundColor: '#fff',
                        padding: '12px',
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                      }}>
                        {error.stack}
                      </pre>
                    </Paragraph>
                  )}
                  
                  {errorInfo?.componentStack && (
                    <Paragraph>
                      <Text strong>Component Stack:</Text>
                      <pre style={{ 
                        fontSize: 12, 
                        overflow: 'auto',
                        backgroundColor: '#fff',
                        padding: '12px',
                        border: '1px solid #d9d9d9',
                        borderRadius: '4px',
                      }}>
                        {errorInfo.componentStack}
                      </pre>
                    </Paragraph>
                  )}
                </Panel>
              </Collapse>
            )}
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for easier use
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
}
