'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, Alert, Typography, Spin, Result } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const { Title, Text } = Typography;

function ForgotPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const onFinish = async (values: { email: string }) => {
    setLoading(true);
    setError('');
    setEmail(values.email);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send reset email');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ 
        minHeight: '100vh',
        minHeight: '100dvh',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <Card style={{ 
          width: '100%',
          maxWidth: '500px',
          textAlign: 'center',
          borderRadius: '12px'
        }}>
          <Result
            status="success"
            title="Reset Email Sent!"
            subTitle={
              <div style={{ padding: '0 10px' }}>
                <p style={{ fontSize: 'clamp(14px, 3vw, 16px)' }}>
                  We've sent a password reset link to:
                </p>
                <Text strong style={{ 
                  fontSize: 'clamp(16px, 3.5vw, 18px)',
                  display: 'block',
                  margin: '8px 0',
                  wordBreak: 'break-all'
                }}>
                  {email}
                </Text>
                <p style={{ 
                  marginTop: '16px',
                  fontSize: 'clamp(14px, 3vw, 16px)'
                }}>
                  Please check your email and click the link to reset your password.
                  The link will expire in 1 hour.
                </p>
              </div>
            }
            extra={[
              <Button 
                key="signin"
                type="primary" 
                onClick={() => router.push('/auth/signin')}
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px',
                  fontWeight: '500',
                  minWidth: '140px'
                }}
              >
                Back to Sign In
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      minHeight: '100dvh',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div style={{ 
        textAlign: 'center',
        width: '100%',
        maxWidth: '400px'
      }}>
        {/* Responsive Lottie Animation */}
        <div style={{ 
          width: '100%',
          maxWidth: '250px',
          height: 'auto',
          aspectRatio: '1',
          margin: '0 auto',
          marginBottom: '-30px',
          '@media (max-width: 480px)': {
            maxWidth: '200px',
            marginBottom: '-20px'
          }
        }}>
          <DotLottieReact
            src="https://lottie.host/4db68bbd-31f6-4cd8-84eb-189de081159a/IGmMCqhzpt.lottie"
            loop
            autoplay
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        
        <Card style={{ 
          width: '100%',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          borderRadius: '12px'
        }}>
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '24px',
            padding: '0 10px'
          }}>
            <Title level={2} style={{
              fontSize: 'clamp(24px, 5vw, 32px)',
              marginBottom: '8px'
            }}>
              Forgot Password
            </Title>
            <p style={{ 
              color: '#666',
              fontSize: 'clamp(14px, 3vw, 16px)',
              margin: 0,
              lineHeight: 1.5
            }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form
            name="forgot-password"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            size="large"
            style={{ textAlign: 'left' }}
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' }
              ]}
            >
              <Input 
                prefix={<MailOutlined />} 
                placeholder="Email Address" 
                type="email"
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px'
                }}
                autoComplete="email"
                inputMode="email"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: '16px' }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                block
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                Send Reset Link
              </Button>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button 
                type="text" 
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push('/auth/signin')}
                block
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px'
                }}
              >
                Back to Sign In
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: '100vh',
        minHeight: '100dvh',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Spin size="large" />
      </div>
    }>
      <ForgotPasswordForm />
    </Suspense>
  );
}