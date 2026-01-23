'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Card,
  Form,
  Select,
  Upload,
  Button,
  message,
  Space,
  Alert,
  Row,
  Col,
  Input,
} from 'antd';
import {
  UploadOutlined,
  InboxOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { motion } from 'framer-motion';
import ModernDashboardLayout from '@/components/layouts/ModernDashboardLayout';

const { Option } = Select;
const { Dragger } = Upload;

const COMPANIES = [
  { value: 'murphy_web_services', label: 'Murphy Web Services', short: 'MWSI', color: '#3B82F6' },
  { value: 'esystems_management', label: 'E-Systems Management', short: 'ESM', color: '#10B981' },
  { value: 'mm_secretarial', label: 'M&M Secretarial Services', short: 'M&M', color: '#F59E0B' },
  { value: 'dpm', label: 'DPM Incorporated', short: 'DPM', color: '#8B5CF6' },
  { value: 'linkage_web_solutions', label: 'Linkage Web Solutions', short: 'LWS', color: '#EC4899' },
  { value: 'wdds', label: 'WDDS', short: 'WDDS', color: '#06B6D4' },
  { value: 'mm_leasing', label: 'M&M Leasing Services', short: 'MLS', color: '#F97316' },
  { value: 'hardin_bar_grill', label: 'Hardin Bar & Grill', short: 'HBG', color: '#EF4444' },
  { value: 'mphi', label: 'MPHI', short: 'MPHI', color: '#14B8A6' },
];

const DOCUMENT_TYPES = [
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'other', label: 'Other' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
].map(m => ({ value: m, label: m }));

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => ({
  value: currentYear - i,
  label: (currentYear - i).toString(),
}));

export default function AccountingUploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const handleUpload = async (values: any) => {
    // Validate company selection
    if (!values.company && !selectedCompany) {
      message.error('Please select a company');
      return;
    }

    if (fileList.length === 0) {
      message.error('Please select a file to upload');
      return;
    }

    // Use selectedCompany as fallback if form value is not set
    const companyValue = values.company || selectedCompany;

    setUploading(true);

    try {
      const file = fileList[0];
      const formData = new FormData();
      
      // Get the actual file - handle both UploadFile and File types
      const actualFile = file.originFileObj || file;
      if (!actualFile) {
        throw new Error('Invalid file object');
      }
      
      // Try to extract month/year from filename if it seems to be a bank statement
      let suggestedMonth = values.month;
      let suggestedYear = values.year;
      
      const fileName = (actualFile as File).name.toLowerCase();
      
      // Check if filename contains month/year patterns
      const monthMatch = fileName.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
      const yearMatch = fileName.match(/\b(20\d{2})\b/);
      
      if (monthMatch && yearMatch && !values.month && !values.year) {
        // Only use filename suggestions if form fields are empty
        const monthMap: Record<string, string> = {
          'jan': 'January', 'feb': 'February', 'mar': 'March', 'apr': 'April',
          'may': 'May', 'jun': 'June', 'jul': 'July', 'aug': 'August',
          'sep': 'September', 'oct': 'October', 'nov': 'November', 'dec': 'December'
        };
        
        suggestedMonth = monthMap[monthMatch[1].toLowerCase()];
        suggestedYear = parseInt(yearMatch[1]);
        
        // Update form with suggested values
        form.setFieldsValue({
          company: values.company,
          month: suggestedMonth,
          year: suggestedYear,
          documentType: values.documentType
        });
        
        message.info(`Detected ${suggestedMonth} ${suggestedYear} from filename. Please verify these values.`);
      }
      
      formData.append('file', actualFile as Blob);
      formData.append('company', companyValue);
      formData.append('month', suggestedMonth);
      formData.append('year', suggestedYear.toString());
      formData.append('documentType', values.documentType);

      console.log('Uploading document:', {
        company: companyValue,
        month: suggestedMonth,
        year: suggestedYear,
        documentType: values.documentType,
        fileName: (actualFile as File).name,
        detectedFromFile: monthMatch && yearMatch ? true : false
      });

      const response = await fetch('/api/accounting/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();
      
      message.success(`Document uploaded successfully! Manus AI is now processing it.`);
      
      setFileList([]);
      form.resetFields();
      setSelectedCompany(null);
      router.push(`/accounting-manus/${companyValue}`);

    } catch (error: any) {
      console.error('Upload error:', error);
      message.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const uploadProps = {
    onRemove: (file: UploadFile) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file: File) => {
      const isValidType = file.type === 'application/pdf' || 
                         file.type.startsWith('image/');
      
      if (!isValidType) {
        message.error('You can only upload PDF or image files!');
        return false;
      }

      const isLt25M = file.size / 1024 / 1024 < 25;
      if (!isLt25M) {
        message.error('File must be smaller than 25MB!');
        return false;
      }

      setFileList([file as any]);
      return false;
    },
    fileList,
  };

  if (status === 'loading') {
    return (
      <ModernDashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <p>Loading...</p>
        </div>
      </ModernDashboardLayout>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  return (
    <ModernDashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Upload Accounting Document
        </h1>
        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
          Upload financial documents for automated AI analysis by Manus
        </p>
      </motion.div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="gradient-card mb-6">
              <Alert
                message="Automated AI Processing"
                description="Documents are automatically processed by Manus AI. OCR extraction, transaction parsing, and P&L generation happen automatically within 5-10 minutes."
                type="info"
                showIcon
                icon={<CheckCircleOutlined />}
                style={{ borderRadius: '12px' }}
              />
            </Card>

            {/* Visual Company Selector */}
            <Card title="Select Company" className="gradient-card mb-6">
              <Row gutter={[16, 16]}>
                {COMPANIES.map((company, index) => (
                  <Col xs={12} sm={8} md={6} key={company.value}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div
                        onClick={() => {
                          form.setFieldValue('company', company.value);
                          setSelectedCompany(company.value);
                        }}
                        className={`p-4 rounded-xl cursor-pointer text-center transition-all ${
                          selectedCompany === company.value
                            ? 'ring-2 ring-offset-2'
                            : ''
                        }`}
                        style={{
                          background: selectedCompany === company.value
                            ? `linear-gradient(135deg, ${company.color} 0%, ${company.color}dd 100%)`
                            : 'var(--bg-secondary)',
                          color: selectedCompany === company.value ? 'white' : 'var(--text-primary)',
                          borderRadius: '12px',
                          ringColor: company.color,
                        }}
                      >
                        <div className="text-2xl font-bold mb-1">{company.short}</div>
                        <div className="text-xs">{company.label.split(' ').slice(0, 2).join(' ')}</div>
                      </div>
                    </motion.div>
                  </Col>
                ))}
              </Row>
            </Card>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleUpload}
              initialValues={{
                documentType: 'bank_statement',
                month: MONTHS[new Date().getMonth()].value,
                year: currentYear,
              }}
            >
              <Form.Item name="company" hidden rules={[{ required: true, message: 'Please select a company' }]}>
                <Input />
              </Form.Item>

              <Card title="Document Details" className="gradient-card mb-6">
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Month"
                      name="month"
                      rules={[{ required: true, message: 'Please select month' }]}
                    >
                      <Select size="large" placeholder="Select month">
                        {MONTHS.map(month => (
                          <Option key={month.value} value={month.value}>
                            {month.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Year"
                      name="year"
                      rules={[{ required: true, message: 'Please select year' }]}
                    >
                      <Select size="large" placeholder="Select year">
                        {YEARS.map(year => (
                          <Option key={year.value} value={year.value}>
                            {year.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="Document Type"
                  name="documentType"
                  rules={[{ required: true, message: 'Please select document type' }]}
                >
                  <Select size="large" placeholder="Select document type">
                    {DOCUMENT_TYPES.map(type => (
                      <Option key={type.value} value={type.value}>
                        {type.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Card>

              <Card title="Upload File" className="gradient-card mb-6">
                <Dragger {...uploadProps} style={{ borderRadius: '12px' }}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ fontSize: 64, color: 'var(--color-primary)' }} />
                  </p>
                  <p className="ant-upload-text" style={{ color: 'var(--text-primary)' }}>
                    Click or drag file to upload
                  </p>
                  <p className="ant-upload-hint" style={{ color: 'var(--text-secondary)' }}>
                    Support for PDF and image files (JPG, PNG). Maximum 25MB
                  </p>
                </Dragger>
              </Card>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={uploading}
                    size="large"
                    icon={<UploadOutlined />}
                    disabled={!selectedCompany}
                    style={{ borderRadius: '24px', height: '48px', padding: '0 32px' }}
                  >
                    Upload & Process with Manus AI
                  </Button>
                  <Button
                    size="large"
                    onClick={() => {
                      form.resetFields();
                      setFileList([]);
                      setSelectedCompany(null);
                    }}
                    style={{ borderRadius: '24px', height: '48px' }}
                  >
                    Reset
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </motion.div>
        </Col>

        <Col xs={24} lg={8}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card title="How It Works" className="gradient-card mb-6">
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {[
                  { step: '1', title: 'Select Company', desc: 'Choose which company this document belongs to' },
                  { step: '2', title: 'Upload Document', desc: 'Drag and drop your PDF or image file' },
                  { step: '3', title: 'Auto Processing', desc: 'Manus AI performs OCR and analysis' },
                  { step: '4', title: 'View Results', desc: 'Access P&L statements and insights' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                      }}
                    >
                      {item.step}
                    </div>
                    <div>
                      <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </Space>
            </Card>

            <Card title="Supported Files" className="gradient-card">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div className="flex items-center gap-2">
                  <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
                  <span style={{ color: 'var(--text-primary)' }}>Bank Statements (PDF)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
                  <span style={{ color: 'var(--text-primary)' }}>Invoices (PDF, Images)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
                  <span style={{ color: 'var(--text-primary)' }}>Receipts (PDF, Images)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
                  <span style={{ color: 'var(--text-primary)' }}>Financial Reports</span>
                </div>
              </Space>
            </Card>
          </motion.div>
        </Col>
      </Row>
    </ModernDashboardLayout>
  );
}
