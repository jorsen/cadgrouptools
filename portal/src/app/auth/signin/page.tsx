'use client';

import { signIn } from 'next-auth/react';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Form, Input, Button, Card, Alert, Typography, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const { Title } = Typography;

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
      } else {
        router.push(callbackUrl);
      }
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      minHeight: '100dvh', // Dynamic viewport height for mobile browsers
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
              CADGroup Tools Portal
            </Title>
            <p style={{ 
              color: '#666',
              fontSize: 'clamp(14px, 3vw, 16px)',
              margin: 0
            }}>
              Sign in to your account
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
            name="signin"
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
                prefix={<UserOutlined />} 
                placeholder="Email" 
                type="email"
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px' // Prevents zoom on iOS
                }}
                autoComplete="email"
                inputMode="email"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="Password"
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px'
                }}
                autoComplete="current-password"
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
                Sign In
              </Button>
            </Form.Item>
          </Form>

          <div style={{ 
            textAlign: 'center', 
            marginTop: '16px',
            fontSize: 'clamp(14px, 3vw, 16px)'
          }}>
            <a 
              href="/auth/forgot-password" 
              style={{ 
                color: '#1677ff', 
                display: 'block', 
                marginBottom: '12px',
                textDecoration: 'none',
                padding: '8px'
              }}
            >
              Forgot your password?
            </a>
            <a 
              href="/auth/register" 
              style={{ 
                color: '#1677ff',
                textDecoration: 'none',
                padding: '8px',
                display: 'inline-block'
              }}
            >
              Don't have an account? Register
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function SignInPage() {
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
      <SignInForm />
    </Suspense>
  );
}