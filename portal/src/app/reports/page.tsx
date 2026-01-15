'use client';

import { Card, Col, Row, Typography } from 'antd';
import {
  DollarOutlined,
  FundOutlined,
  PieChartOutlined,
  RiseOutlined,
  UnorderedListOutlined,
  GlobalOutlined,
  SwapOutlined,
  WalletOutlined,
  FileTextOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import CompanySelector from '@/components/reports/CompanySelector';
import { Alert } from 'antd';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const { Title, Paragraph } = Typography;

const reportCategories = [
  {
    title: 'Individual Company Reports',
    reports: [
      {
        title: 'Profit & Loss Statement',
        description: 'Revenue and expense breakdown with net income analysis',
        icon: <DollarOutlined style={{ fontSize: 32 }} />,
        href: '/reports/pl',
        color: '#52c41a',
      },
      {
        title: 'Cash Flow Statement',
        description: 'Track cash inflows, outflows, and ending cash position',
        icon: <FundOutlined style={{ fontSize: 32 }} />,
        href: '/reports/cashflow',
        color: '#1890ff',
      },
      {
        title: 'Expense Analysis',
        description: 'Detailed expense breakdown by category and vendor',
        icon: <PieChartOutlined style={{ fontSize: 32 }} />,
        href: '/reports/expenses',
        color: '#ff4d4f',
      },
      {
        title: 'Revenue Analysis',
        description: 'Revenue sources and month-over-month trends',
        icon: <RiseOutlined style={{ fontSize: 32 }} />,
        href: '/reports/revenue',
        color: '#722ed1',
      },
      {
        title: 'Transaction Ledger',
        description: 'Complete transaction register with advanced filtering',
        icon: <UnorderedListOutlined style={{ fontSize: 32 }} />,
        href: '/reports/transactions',
        color: '#fa8c16',
      },
      {
        title: 'Check Register',
        description: 'Monthly list of all checks written with check numbers',
        icon: <FileTextOutlined style={{ fontSize: 32 }} />,
        href: '/reports/checks',
        color: '#13c2c2',
      },
    ],
  },
  {
    title: 'Consolidated Reports',
    reports: [
      {
        title: 'Consolidated P&L',
        description: 'Combined profit & loss across multiple companies',
        icon: <GlobalOutlined style={{ fontSize: 32 }} />,
        href: '/reports/consolidated/pl',
        color: '#13c2c2',
      },
      {
        title: 'Company Comparison',
        description: 'Side-by-side performance comparison',
        icon: <SwapOutlined style={{ fontSize: 32 }} />,
        href: '/reports/consolidated/comparison',
        color: '#eb2f96',
      },
      {
        title: 'Cash Position',
        description: 'Total cash across all companies and accounts',
        icon: <WalletOutlined style={{ fontSize: 32 }} />,
        href: '/reports/consolidated/cash',
        color: '#faad14',
      },
    ],
  },
  {
    title: 'Tax & Compliance',
    reports: [
      {
        title: 'Tax Summary',
        description: 'Quarterly tax summary with BIR-ready data',
        icon: <FileTextOutlined style={{ fontSize: 32 }} />,
        href: '/reports/tax-summary',
        color: '#2f54eb',
      },
      {
        title: 'Data Quality',
        description: 'Uncategorized transactions and categorization rate',
        icon: <WarningOutlined style={{ fontSize: 32 }} />,
        href: '/reports/uncategorized',
        color: '#fa541c',
      },
    ],
  },
];

export default function ReportsPage() {
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/reports');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      {/* Simple Header */}
      <div style={{ 
        background: '#fff', 
        padding: '16px 24px', 
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={3} style={{ margin: 0 }}>Financial Reports</Title>
          <Link href="/dashboard" style={{ textDecoration: 'none' }}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 24px' }}>
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Comprehensive financial reporting for single and multi-company analysis
        </Paragraph>

        {/* Company Selector */}
        <Card style={{ marginBottom: 32 }}>
          <Title level={4} style={{ marginBottom: 16 }}>Filter by Company</Title>
          <CompanySelector
            value={selectedCompany}
            onChange={(val) => setSelectedCompany(val as string)}
            showAllOption={true}
            placeholder="All Companies"
            style={{ maxWidth: 400 }}
          />
          {selectedCompany && (
            <Alert
              message="Company Selected"
              description="Reports will open with this company pre-selected for faster access"
              type="info"
              style={{ marginTop: 16 }}
              closable
              onClose={() => setSelectedCompany('')}
            />
          )}
        </Card>

        {/* Report Cards */}
        {reportCategories.map((category, index) => (
          <div key={index} style={{ marginBottom: 48 }}>
            <Title level={3} style={{ marginBottom: 16 }}>
              {category.title}
            </Title>
            <Row gutter={[16, 16]}>
              {category.reports.map((report, reportIndex) => (
                <Col key={reportIndex} xs={24} sm={12} lg={8}>
                  <Link 
                    href={selectedCompany ? `${report.href}?companyId=${selectedCompany}` : report.href} 
                    style={{ textDecoration: 'none' }}
                  >
                    <Card
                      hoverable
                      style={{ height: '100%' }}
                      bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                        <div
                          style={{
                            backgroundColor: `${report.color}15`,
                            color: report.color,
                            padding: 16,
                            borderRadius: 8,
                            marginRight: 16,
                          }}
                        >
                          {report.icon}
                        </div>
                        <Title level={4} style={{ margin: 0, flex: 1 }}>
                          {report.title}
                        </Title>
                      </div>
                      <Paragraph type="secondary" style={{ margin: 0 }}>
                        {report.description}
                      </Paragraph>
                    </Card>
                  </Link>
                </Col>
              ))}
            </Row>
          </div>
        ))}
      </div>
    </div>
  );
}
