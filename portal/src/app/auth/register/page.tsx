'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Card, Alert, Typography, Select, Spin } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { signIn } from 'next-auth/react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const { Title } = Typography;
const { Option } = Select;

function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const onFinish = async (values: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    role: string;
  }) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
          role: values.role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      setSuccess(true);
      
      // Auto sign in after successful registration
      const signInResult = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (signInResult?.ok) {
        router.push('/dashboard');
      } else {
        // If auto sign-in fails, redirect to sign-in page
        router.push('/auth/signin');
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
        maxWidth: '450px'
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
              Create Account
            </Title>
            <p style={{ 
              color: '#666',
              fontSize: 'clamp(14px, 3vw, 16px)',
              margin: 0
            }}>
              Register for CADGroup Tools Portal
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

          {success && (
            <Alert
              message="Registration successful! Redirecting..."
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form
            name="register"
            onFinish={onFinish}
            autoComplete="off"
            layout="vertical"
            size="large"
            style={{ textAlign: 'left' }}
          >
            <Form.Item
              name="name"
              rules={[
                { required: true, message: 'Please input your name!' },
                { min: 2, message: 'Name must be at least 2 characters!' }
              ]}
            >
              <Input 
                prefix={<UserOutlined />} 
                placeholder="Full Name"
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px' // Prevents zoom on iOS
                }}
                autoComplete="name"
              />
            </Form.Item>

            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' }
              ]}
            >
              <Input 
                prefix={<MailOutlined />} 
                placeholder="Email" 
                type="email"
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px'
                }}
                autoComplete="email"
                inputMode="email"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: 'Please input your password!' },
                { min: 6, message: 'Password must be at least 6 characters!' }
              ]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="Password"
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
                placeholder="Confirm Password"
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px'
                }}
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              name="role"
              rules={[{ required: true, message: 'Please select a role!' }]}
            >
              <Select 
                placeholder="Select Role"
                style={{ 
                  minHeight: '44px',
                  fontSize: '16px'
                }}
              >
                <Option value="staff">Staff</Option>
                <Option value="admin">Admin</Option>
              </Select>
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
                Register
              </Button>
            </Form.Item>
          </Form>

          <div style={{ 
            textAlign: 'center', 
            marginTop: '16px',
            fontSize: 'clamp(14px, 3vw, 16px)'
          }}>
            <a 
              href="/auth/signin" 
              style={{ 
                color: '#1677ff',
                textDecoration: 'none',
                padding: '10px',
                display: 'inline-block'
              }}
            >
              Already have an account? Sign In
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function RegisterPage() {
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
      <RegisterForm />
    </Suspense>
  );
}