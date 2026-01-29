'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  Modal,
  Form,
  Select,
  message,
  Dropdown,
  Avatar,
  Typography,
  Row,
  Col,
  Statistic,
  Alert,
  Switch,
  Tooltip,
  Badge,
  Divider,
} from 'antd';
import {
  UserOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  MoreOutlined,
  MailOutlined,
  TeamOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  UserAddOutlined,
  KeyOutlined,
  FilterOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useSession } from 'next-auth/react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageHeader from '@/components/common/PageHeader';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  department: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  createdAt: string;
  avatar?: string;
}

export default function UserManagementPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, [session]);

  const fetchUsers = async () => {
    if (session?.user?.role !== 'admin') return;
    
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      
      // Map the backend data to match our User interface
      const mappedUsers = data.users.map((user: any) => ({
        id: user._id || user.id,
        name: user.name || 'Unknown User',
        email: user.email || '',
        role: user.role || 'staff',
        department: user.department || '',
        status: user.status || 'active',
        lastLogin: user.lastLogin || '-',
        createdAt: user.createdAt || new Date().toISOString(),
      }));
      
      setUsers(mappedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setIsModalVisible(true);
  };

  const handleDeleteUser = (user: User) => {
    confirm({
      title: 'Delete User',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete ${user.name}? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await fetch(`/api/admin/users?id=${user.id}`, {
            method: 'DELETE',
          });
          
          if (!response.ok) throw new Error('Failed to delete user');
          
          setUsers(users.filter(u => u.id !== user.id));
          message.success('User deleted successfully');
        } catch (error) {
          console.error('Error deleting user:', error);
          message.error('Failed to delete user');
        }
      },
    });
  };

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          update: { status: newStatus }
        }),
      });
      
      if (!response.ok) throw new Error('Failed to update user status');
      
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, status: newStatus } : u
      ));
      message.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error updating user status:', error);
      message.error('Failed to update user status');
    }
  };

  const handleResetPassword = (user: User) => {
    confirm({
      title: 'Reset Password',
      icon: <KeyOutlined />,
      content: `Send password reset email to ${user.email}?`,
      onOk: async () => {
        try {
          const response = await fetch('/api/admin/users/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
          });
          
          if (!response.ok) throw new Error('Failed to reset password');
          
          const data = await response.json();
          
          // Show result to admin
          Modal.success({
            title: 'Password Reset Successfully',
            content: (
              <div>
                <p>Password has been reset for {user.email}</p>
                {data.emailSent ? (
                  <div style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', padding: '10px', borderRadius: '4px', margin: '10px 0' }}>
                    <p style={{ color: '#52c41a', margin: 0 }}>✅ Password reset email sent successfully!</p>
                  </div>
                ) : (
                  <>
                    <p><strong>Temporary Password:</strong> {data.tempPassword}</p>
                    <p style={{ color: '#faad14' }}>
                      ⚠️ Failed to send reset email. Please share the new password manually.
                    </p>
                  </>
                )}
                <p style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '10px' }}>
                  User will be required to change this password on next login.
                </p>
              </div>
            ),
          });
        } catch (error) {
          console.error('Error resetting password:', error);
          message.error('Failed to reset password');
        }
      },
    });
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      if (editingUser) {
        // Update existing user
        const response = await fetch('/api/admin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingUser.id,
            update: values
          }),
        });
        
        if (!response.ok) throw new Error('Failed to update user');
        
        const data = await response.json();
        setUsers(users.map(u => 
          u.id === editingUser.id ? { ...u, ...values } : u
        ));
        message.success('User updated successfully');
      } else {
        // Create new user
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create user');
        }
        
        const data = await response.json();
        
        // Show the temporary password to the admin
        Modal.success({
          title: 'User Created Successfully',
          content: (
            <div>
              <p>User <strong>{values.name}</strong> has been created.</p>
              <p><strong>Email:</strong> {values.email}</p>
              {data.emailSent ? (
                <div style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', padding: '10px', borderRadius: '4px', margin: '10px 0' }}>
                  <p style={{ color: '#52c41a', margin: 0 }}>✅ Invitation email sent successfully!</p>
                </div>
              ) : (
                <>
                  <p><strong>Temporary Password:</strong> {data.tempPassword}</p>
                  <p style={{ color: '#faad14' }}>
                    ⚠️ Failed to send invitation email. Please share the credentials manually.
                  </p>
                </>
              )}
              <p style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '10px' }}>
                User will be required to change their password on first login.
              </p>
            </div>
          ),
        });
        
        // Refresh the users list
        await fetchUsers();
      }
      
      setIsModalVisible(false);
      form.resetFields();
    } catch (error: any) {
      console.error('Error saving user:', error);
      message.error(error.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredUsers = () => {
    return users.filter(user => {
      const userName = user.name || '';
      const userEmail = user.email || '';
      const matchesSearch = userName.toLowerCase().includes(searchText.toLowerCase()) ||
                          userEmail.toLowerCase().includes(searchText.toLowerCase());
      const matchesRole = filterRole === 'all' || user.role === filterRole;
      const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
      return matchesSearch && matchesRole && matchesStatus;
    });
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (record: User) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }}>
            {(record.name || 'U').charAt(0)}
          </Avatar>
          <div>
            <Text strong>{record.name || 'Unknown User'}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email || ''}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'admin' ? 'gold' : 'blue'}>
          {(role || 'staff').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (department: string) => department || '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const safeStatus = status || 'active';
        const config = {
          active: { color: 'green', icon: <CheckCircleOutlined /> },
          inactive: { color: 'gray', icon: <CloseCircleOutlined /> },
          suspended: { color: 'red', icon: <ExclamationCircleOutlined /> },
        };
        const statusConfig = config[safeStatus as keyof typeof config] || config.active;
        return (
          <Tag color={statusConfig.color} icon={statusConfig.icon}>
            {safeStatus.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (date: string) => date === '-' ? '-' : dayjs(date).format('MMM DD, YYYY HH:mm'),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: User) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditUser(record)}
            />
          </Tooltip>
          <Tooltip title={record.status === 'active' ? 'Deactivate' : 'Activate'}>
            <Button
              type="text"
              icon={record.status === 'active' ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => handleToggleStatus(record)}
            />
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'reset',
                  label: 'Reset Password',
                  icon: <KeyOutlined />,
                  onClick: () => handleResetPassword(record),
                },
                {
                  key: 'email',
                  label: 'Send Email',
                  icon: <MailOutlined />,
                  onClick: () => message.info('Email composer would open here'),
                },
                {
                  type: 'divider',
                },
                {
                  key: 'delete',
                  label: 'Delete User',
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => handleDeleteUser(record),
                  disabled: record.email === session?.user?.email,
                },
              ],
            }}
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    admins: users.filter(u => u.role === 'admin').length,
    recentLogins: users.filter(u => {
      if (u.lastLogin === '-') return false;
      return dayjs().diff(dayjs(u.lastLogin), 'day') <= 7;
    }).length,
  };

  // Only admins can access this page
  if (session?.user?.role !== 'admin') {
    return (
      <DashboardLayout
        breadcrumbs={[
          { title: 'Admin', href: '/admin' },
          { title: 'User Management' },
        ]}
      >
        <Alert
          message="Access Denied"
          description="You need administrator privileges to access this page."
          type="error"
          showIcon
          style={{ maxWidth: 600, margin: '100px auto' }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { title: 'Admin', href: '/admin' },
        { title: 'User Management' },
      ]}
    >
      <PageHeader
        title="User Management"
        subtitle="Manage user accounts and permissions"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchUsers} loading={loading}>
              Refresh
            </Button>
            <Button icon={<DownloadOutlined />}>
              Export
            </Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={handleAddUser}>
              Add User
            </Button>
          </Space>
        }
      />

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={stats.total}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Active Users"
              value={stats.active}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Administrators"
              value={stats.admins}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<SafetyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Recent Logins (7d)"
              value={stats.recentLogins}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large" wrap>
          <Input
            placeholder="Search users..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
          <Select
            value={filterRole}
            onChange={setFilterRole}
            style={{ width: 120 }}
            placeholder="Filter by role"
          >
            <Option value="all">All Roles</Option>
            <Option value="admin">Admin</Option>
            <Option value="staff">Staff</Option>
          </Select>
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 120 }}
            placeholder="Filter by status"
          >
            <Option value="all">All Status</Option>
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
            <Option value="suspended">Suspended</Option>
          </Select>
          <Button
            icon={<FilterOutlined />}
            onClick={() => {
              setSearchText('');
              setFilterRole('all');
              setFilterStatus('all');
            }}
          >
            Clear Filters
          </Button>
        </Space>
      </Card>

      {/* Users Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={getFilteredUsers()}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} users`,
          }}
        />
      </Card>

      {/* Add/Edit User Modal */}
      <Modal
        title={editingUser ? 'Edit User' : 'Add New User'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={loading}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            role: 'staff',
            department: 'Sales',
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter name' }]}
              >
                <Input prefix={<UserOutlined />} placeholder="Full Name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Invalid email format' },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="Email"
                  disabled={!!editingUser}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="role"
                label="Role"
                rules={[{ required: true, message: 'Please select role' }]}
              >
                <Select placeholder="Select Role">
                  <Option value="admin">Admin</Option>
                  <Option value="staff">Staff</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="department"
                label="Department"
                rules={[{ required: true, message: 'Please select department' }]}
              >
                <Select placeholder="Select Department">
                  <Option value="Management">Management</Option>
                  <Option value="Sales">Sales</Option>
                  <Option value="Marketing">Marketing</Option>
                  <Option value="Engineering">Engineering</Option>
                  <Option value="HR">HR</Option>
                  <Option value="Support">Support</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {!editingUser && (
            <Alert
              message="Initial Password"
              description="A temporary password will be sent to the user's email address. They will be required to change it on first login."
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Form>
      </Modal>
    </DashboardLayout>
  );
}