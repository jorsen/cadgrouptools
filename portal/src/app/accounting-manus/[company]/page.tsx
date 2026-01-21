'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import {
  Card,
  Table,
  Button,
  Space,
  Tabs,
  Empty,
  message,
  Row,
  Col,
} from 'antd';
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  PlusOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { motion } from 'framer-motion';
import ModernDashboardLayout from '@/components/layouts/ModernDashboardLayout';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import RevenueExpenseChart from '@/components/charts/RevenueExpenseChart';

const { TabPane } = Tabs;

interface AccountingDoc {
  _id: string;
  month: string;
  year: number;
  documentType: string;
  supabaseUrl: string;
  processingStatus: string;
  analysisResult?: any;
  createdAt: string;
}

interface PLStatement {
  month: string;
  year: number;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  categories?: Record<string, number>;
}

const COMPANY_NAMES: Record<string, string> = {
  murphy_web_services: 'Murphy Web Services Inc',
  esystems_management: 'E-Systems Management Inc',
  mm_secretarial: 'M&M Secretarial Services Inc',
  dpm: 'DPM Incorporated',
  linkage_web_solutions: 'Linkage Web Solutions Enterprise Inc',
  wdds: 'WDDS',
  mm_leasing: 'M&M Leasing Services',
  hardin_bar_grill: 'Hardin Bar & Grill',
  mphi: 'MPHI',
};

export default function CompanyAccountingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const company = params.company as string;

  const [documents, setDocuments] = useState<AccountingDoc[]>([]);
  const [plStatements, setPLStatements] = useState<PLStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && company) {
      fetchData();
    }
  }, [status, company]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/accounting/${company}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch accounting data');
      }

      const data = await response.json();
      setDocuments(data.documents || []);
      setPLStatements(data.plStatements || []);
    } catch (error: any) {
      message.error(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const reprocessDocuments = async () => {
    setReprocessing(true);
    try {
      console.log('Starting document reprocessing for company:', company);
      
      const response = await fetch('/api/accounting/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company }),
      });

      const data = await response.json();
      console.log('Reprocess response:', data);

      if (!response.ok) {
        console.error('Reprocess failed:', data);
        throw new Error(data.error || data.message || 'Failed to reprocess documents');
      }

      if (data.failed > 0) {
        // Show details about failures
        const failedDocs = data.results?.filter((r: any) => r.status === 'error') || [];
        const errorMessages = failedDocs.map((r: any) => r.error).join(', ');
        message.warning(`Processed ${data.processed} documents. ${data.failed} failed: ${errorMessages}`);
      } else if (data.processed > 0) {
        message.success(`Processed ${data.processed} documents successfully`);
      } else {
        message.info(data.message || 'No documents to process');
      }
      
      // Refresh data to show updated P&L statements
      await fetchData();
    } catch (error: any) {
      console.error('Reprocess error:', error);
      message.error(error.message || 'Failed to reprocess documents');
    } finally {
      setReprocessing(false);
    }
  };

  // Check if there are documents that need reprocessing
  const pendingDocuments = documents.filter(
    d => ['stored', 'uploaded', 'failed'].includes(d.processingStatus)
  );

  const documentColumns: ColumnsType<AccountingDoc> = [
    {
      title: 'Period',
      key: 'period',
      render: (_, record) => `${record.month} ${record.year}`,
      sorter: (a, b) => {
        const dateA = new Date(`${a.month} 1, ${a.year}`);
        const dateB = new Date(`${b.month} 1, ${b.year}`);
        return dateB.getTime() - dateA.getTime();
      },
    },
    {
      title: 'Type',
      dataIndex: 'documentType',
      key: 'documentType',
      render: (type: string) => type.replace('_', ' ').toUpperCase(),
    },
    {
      title: 'Status',
      dataIndex: 'processingStatus',
      key: 'status',
      render: (status: string) => <StatusBadge status={status as any} size="small" />,
    },
    {
      title: 'Uploaded',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button
          type="link"
          icon={<DownloadOutlined />}
          href={record.supabaseUrl}
          target="_blank"
        >
          Download
        </Button>
      ),
    },
  ];

  const companyName = COMPANY_NAMES[company] || company;
  const latestPL = plStatements[0];

  // Prepare chart data
  const chartData = plStatements.slice(0, 6).reverse().map(pl => ({
    month: `${pl.month.substring(0, 3)} ${pl.year}`,
    revenue: pl.totalRevenue || 0,
    expenses: pl.totalExpenses || 0,
  }));

  if (loading) {
    return (
      <ModernDashboardLayout>
        <LoadingSkeleton type="detail" />
      </ModernDashboardLayout>
    );
  }

  return (
    <ModernDashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push('/accounting-manus')}
              size="large"
              style={{ marginBottom: 16, borderRadius: '24px' }}
            >
              Back
            </Button>
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {companyName}
            </h1>
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
              Financial documents and AI-powered analysis
            </p>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchData}
              size="large"
              style={{ borderRadius: '24px' }}
            >
              Refresh
            </Button>
            {pendingDocuments.length > 0 && (
              <Button
                icon={<SyncOutlined spin={reprocessing} />}
                onClick={reprocessDocuments}
                loading={reprocessing}
                size="large"
                style={{ borderRadius: '24px' }}
              >
                Process {pendingDocuments.length} Document{pendingDocuments.length > 1 ? 's' : ''}
              </Button>
            )}
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => router.push('/accounting-manus')}
              size="large"
              style={{ borderRadius: '24px' }}
            >
              Upload Document
            </Button>
          </Space>
        </div>

        {/* KPI Cards */}
        {latestPL && (
          <Row gutter={[24, 24]} className="mb-8 stagger-children">
            <Col xs={24} sm={8}>
              <StatCard
                title="Latest Revenue"
                value={`$${latestPL.totalRevenue?.toLocaleString() || '0'}`}
                icon={<DollarOutlined style={{ fontSize: 20 }} />}
                color="success"
              />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard
                title="Latest Expenses"
                value={`$${latestPL.totalExpenses?.toLocaleString() || '0'}`}
                icon={<DollarOutlined style={{ fontSize: 20 }} />}
                color="error"
              />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard
                title="Net Income"
                value={`$${Math.abs(latestPL.netIncome || 0).toLocaleString()}`}
                icon={latestPL.netIncome >= 0 ? <RiseOutlined style={{ fontSize: 20 }} /> : <FallOutlined style={{ fontSize: 20 }} />}
                color={latestPL.netIncome >= 0 ? 'success' : 'error'}
              />
            </Col>
          </Row>
        )}

        {/* Charts */}
        {chartData.length > 0 && (
          <Card title="Revenue vs Expenses Trend" className="gradient-card mb-6">
            <RevenueExpenseChart data={chartData} />
          </Card>
        )}

        {/* Tabs */}
        <Card className="gradient-card">
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="large">
            <TabPane tab="Documents" key="documents">
              <Table
                columns={documentColumns}
                dataSource={documents}
                rowKey="_id"
                pagination={{
                  pageSize: 10,
                  showTotal: (total) => `Total ${total} documents`,
                }}
                locale={{
                  emptyText: (
                    <EmptyState
                      title="No documents uploaded"
                      description="Upload your first document to start tracking"
                      type="documents"
                      action={{
                        text: 'Upload Document',
                        onClick: () => router.push('/accounting-manus'),
                        icon: <PlusOutlined />,
                      }}
                    />
                  ),
                }}
              />
            </TabPane>

            <TabPane tab="P&L Statements" key="pl">
              {plStatements.length === 0 ? (
                <EmptyState
                  title="No P&L statements yet"
                  description={pendingDocuments.length > 0
                    ? `You have ${pendingDocuments.length} document(s) waiting to be processed. Click the button below to generate P&L statements.`
                    : "Upload documents and they will be automatically processed to generate P&L statements."
                  }
                  type="documents"
                  action={pendingDocuments.length > 0 ? {
                    text: `Process ${pendingDocuments.length} Document${pendingDocuments.length > 1 ? 's' : ''}`,
                    onClick: reprocessDocuments,
                    icon: <SyncOutlined spin={reprocessing} />,
                  } : undefined}
                />
              ) : (
                <div className="space-y-4">
                  {plStatements.map((pl, index) => (
                    <motion.div
                      key={`${pl.month}-${pl.year}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="theme-card">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                              {pl.month} {pl.year}
                            </div>
                            <Space size="large">
                              <div>
                                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Revenue</div>
                                <div className="text-lg font-semibold" style={{ color: 'var(--color-success)' }}>
                                  ${pl.totalRevenue?.toLocaleString() || '0'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Expenses</div>
                                <div className="text-lg font-semibold" style={{ color: 'var(--color-error)' }}>
                                  ${pl.totalExpenses?.toLocaleString() || '0'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Net Income</div>
                                <div className="text-lg font-semibold" style={{ color: pl.netIncome >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                                  ${Math.abs(pl.netIncome || 0).toLocaleString()}
                                </div>
                              </div>
                            </Space>
                          </div>
                          {pl.netIncome >= 0 ? (
                            <RiseOutlined style={{ fontSize: 32, color: 'var(--color-success)' }} />
                          ) : (
                            <FallOutlined style={{ fontSize: 32, color: 'var(--color-error)' }} />
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </TabPane>
          </Tabs>
        </Card>
      </motion.div>
    </ModernDashboardLayout>
  );
}
