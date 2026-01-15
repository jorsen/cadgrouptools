'use client';

import React from 'react';
import { Result, Button } from 'antd';
import { useRouter } from 'next/navigation';
import { HomeOutlined, ArrowLeftOutlined } from '@ant-design/icons';

export default function NotFound() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Result
        status="404"
        title="404"
        subTitle="Sorry, the page you visited does not exist."
        style={{
          backgroundColor: 'white',
          borderRadius: 8,
          padding: 40,
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}
        extra={[
          <Button
            type="primary"
            key="home"
            icon={<HomeOutlined />}
            onClick={() => router.push('/dashboard')}
          >
            Back to Dashboard
          </Button>,
          <Button
            key="back"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
          >
            Go Back
          </Button>,
        ]}
      />
    </div>
  );
}

// Force dynamic rendering
export const dynamic = 'force-dynamic';