'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Form, Input, Button, Card, Alert, Typography, Spin, Result } from 'antd';
import { LockOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const { Title, Text } = Typography;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [userName, setUserName] = useState('');

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token || !email) {
        setError('Invalid reset link. Please request a new password reset.');
        setVerifying(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`
        );
        const data = await response.json();

        if (data.valid) {
          setTokenValid(true);
          setUserName(data.userName || '');
        } else {
          setError(data.error || 'Invalid or expired reset link. Please request a new password reset.');
        }
      } catch (err) {
        setError('Failed to verify reset link. Please try again.');
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token, email]);

  const onFinish = async (values: { password: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  // Loading state
  if (verifying) {
    return (
      <div style={{ 
        minHeight: '100vh',
        minHeight: '100dvh',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Card style={{ 
          textAlign: 'center',
          padding: '40px',
          borderRadius: '12px'
        }}>
          <Spin size="large" />
          <p style={{ marginTop: '16px', color: '#666' }}>Verifying reset link...</p>
        </Card>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid && !success) {
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
            status="error"
            title="Invalid Reset Link"
            subTitle={error || 'This password reset link is invalid or has expired.'}
            extra={[
              <Button 
                key="forgot"
                type="primary" 
                onClick={() => router.push('/auth/forgot-password')}
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                Request New Reset Link
              </Button>,
              <Button 
                key="signin"
                onClick={() => router.push('/auth/signin')}
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px'
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

  // Success state
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
            title="Password Reset Successful!"
            subTitle="Your password has been successfully changed. You can now sign in with your new password."
            extra={[
              <Button 
                key="signin"
                type="primary" 
                onClick={() => router.push('/auth/signin')}
                size="large"
                icon={<CheckCircleOutlined />}
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
              >
                Sign In Now
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  // Reset password form
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
          maxWidth: '200px',
          height: 'auto',
          aspectRatio: '1',
          margin: '0 auto',
          marginBottom: '-20px'
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
              Reset Password
            </Title>
            {userName && (
              <p style={{ 
                color: '#1890ff',
                fontSize: '16px',
                margin: '0 0 8px 0',
                fontWeight: '500'
              }}>
                Hello, {userName}!
              </p>
            )}
            <p style={{ 
              color: '#666',
              fontSize: 'clamp(14px, 3vw, 16px)',
              margin: 0,
              lineHeight: 1.5
            }}>
              Enter your new password below.
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
            name="reset-password"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            size="large"
            style={{ textAlign: 'left' }}
          >
            <Form.Item
              name="password"
              rules={[
                { required: true, message: 'Please input your new password!' },
                { min: 8, message: 'Password must be at least 8 characters!' }
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="New Password" 
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px'
                }}
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your password!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match!'));
                  },
                }),
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="Confirm New Password" 
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px'
                }}
                autoComplete="new-password"
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
                Reset Password
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

export default function ResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}
