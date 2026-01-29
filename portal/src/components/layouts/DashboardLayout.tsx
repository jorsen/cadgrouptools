'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Layout,
  Menu,
  Button,
  Avatar,
  Dropdown,
  Space,
  Badge,
  Breadcrumb,
  Spin,
  theme,
  ConfigProvider,
  Switch,
  Drawer,
} from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  CalculatorOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SunOutlined,
  PlusOutlined,
  HomeOutlined,
  CloseOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';

const { Header, Sider, Content } = Layout;

interface DashboardLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: Array<{ title: string; href?: string }>;
}

export default function DashboardLayout({ children, breadcrumbs = [] }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Only auto-collapse on desktop
      if (!mobile && window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileDrawerVisible(false);
  }, [pathname]);


  if (status === 'loading') {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDarkMode ? '#000' : '#f5f5f5',
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.href = '/auth/signin';
  };

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      onClick: () => router.push('/dashboard'),
    },
    {
      key: '/clients',
      icon: <TeamOutlined />,
      label: 'Clients',
      children: [
        {
          key: '/clients',
          label: 'All Clients',
          onClick: () => router.push('/clients'),
        },
        {
          key: '/clients/new',
          label: 'Add New Client',
          icon: <PlusOutlined />,
          onClick: () => router.push('/clients/new'),
        },
      ],
    },
    {
      key: '/proposals',
      icon: <FileTextOutlined />,
      label: 'Proposals',
      children: [
        {
          key: '/proposals',
          label: 'All Proposals',
          onClick: () => router.push('/proposals'),
        },
        {
          key: '/proposals/new',
          label: 'Create Proposal',
          icon: <PlusOutlined />,
          onClick: () => router.push('/proposals/new'),
        },
      ],
    },
    {
      key: '/accounting',
      icon: <CalculatorOutlined />,
      label: 'Accounting',
      children: [
        {
          key: '/accounting',
          label: 'Overview',
          onClick: () => router.push('/accounting'),
        },
        {
          key: '/accounting/transactions',
          label: 'Transactions',
          onClick: () => router.push('/accounting/transactions'),
        },
        {
          key: '/accounting/upload',
          label: 'Upload Statement',
          onClick: () => router.push('/accounting/upload'),
        },
      ],
    },
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: 'Financial Reports',
      children: [
        {
          key: '/reports',
          label: 'All Reports',
          onClick: () => router.push('/reports'),
        },
        {
          type: 'divider',
        },
        {
          key: 'individual-reports',
          label: 'Individual Company',
          type: 'group',
          children: [
            {
              key: '/reports/pl',
              label: 'P&L Statement',
              onClick: () => router.push('/reports/pl'),
            },
            {
              key: '/reports/cashflow',
              label: 'Cash Flow',
              onClick: () => router.push('/reports/cashflow'),
            },
            {
              key: '/reports/expenses',
              label: 'Expenses',
              onClick: () => router.push('/reports/expenses'),
            },
            {
              key: '/reports/revenue',
              label: 'Revenue',
              onClick: () => router.push('/reports/revenue'),
            },
            {
              key: '/reports/transactions',
              label: 'Transaction Ledger',
              onClick: () => router.push('/reports/transactions'),
            },
            {
              key: '/reports/checks',
              label: 'Check Register',
              onClick: () => router.push('/reports/checks'),
            },
          ],
        },
        {
          type: 'divider',
        },
        {
          key: 'consolidated-reports',
          label: 'Consolidated',
          type: 'group',
          children: [
            {
              key: '/reports/consolidated/pl',
              label: 'Consolidated P&L',
              onClick: () => router.push('/reports/consolidated/pl'),
            },
            {
              key: '/reports/consolidated/comparison',
              label: 'Company Comparison',
              onClick: () => router.push('/reports/consolidated/comparison'),
            },
            {
              key: '/reports/consolidated/cash',
              label: 'Cash Position',
              onClick: () => router.push('/reports/consolidated/cash'),
            },
          ],
        },
        {
          type: 'divider',
        },
        {
          key: 'tax-compliance',
          label: 'Tax & Compliance',
          type: 'group',
          children: [
            {
              key: '/reports/tax-summary',
              label: 'Tax Summary',
              onClick: () => router.push('/reports/tax-summary'),
            },
            {
              key: '/reports/uncategorized',
              label: 'Data Quality',
              onClick: () => router.push('/reports/uncategorized'),
            },
          ],
        },
      ],
    },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => router.push('/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => router.push('/settings'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      onClick: handleSignOut,
      danger: true,
    },
  ];

  const getSelectedKeys = () => {
    // Find exact match first
    if (menuItems.some(item => item?.key === pathname)) {
      return [pathname];
    }
    // Check children
    for (const item of menuItems) {
      if ('children' in item && item.children) {
        const child = item.children.find(c => c?.key === pathname);
        if (child) {
          return [pathname];
        }
      }
    }
    // Default to parent path
    const parentPath = '/' + pathname.split('/')[1];
    return [parentPath];
  };

  const getOpenKeys = () => {
    const parentPath = '/' + pathname.split('/')[1];
    return [parentPath];
  };

  const breadcrumbItems = [
    { title: <HomeOutlined />, href: '/dashboard' },
    ...breadcrumbs,
  ];

  const sidebarContent = (
    <>
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: `1px solid ${isDarkMode ? '#303030' : '#f0f0f0'}`,
        position: 'relative',
      }}>
        <h2 style={{
          color: '#fff',
          margin: 0,
          fontSize: collapsed && !isMobile ? 16 : 20,
          fontWeight: 600,
          transition: 'all 0.3s',
        }}>
          {collapsed && !isMobile ? 'CAD' : 'CADGroup'}
        </h2>
        {isMobile && (
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={() => setMobileDrawerVisible(false)}
            style={{
              position: 'absolute',
              right: 16,
              color: '#fff',
            }}
          />
        )}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={getSelectedKeys()}
        defaultOpenKeys={getOpenKeys()}
        items={menuItems}
        style={{ borderRight: 0 }}
      />
    </>
  );

  return (
      <Layout style={{ minHeight: '100vh', background: isDarkMode ? '#141414' : '#f0f0f0' }}>
        {/* Desktop Sidebar */}
        {!isMobile && (
          <Sider
            trigger={null}
            collapsible
            collapsed={collapsed}
            breakpoint="lg"
            onBreakpoint={(broken) => {
              setCollapsed(broken);
            }}
            style={{
              overflow: 'auto',
              height: '100vh',
              position: 'fixed',
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 100,
              boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
            }}
          >
            {sidebarContent}
          </Sider>
        )}
        
        {/* Mobile Drawer */}
        {isMobile && (
          <Drawer
            placement="left"
            closable={false}
            onClose={() => setMobileDrawerVisible(false)}
            open={mobileDrawerVisible}
            width={280}
            bodyStyle={{ padding: 0, background: '#001529' }}
            style={{ padding: 0 }}
          >
            {sidebarContent}
          </Drawer>
        )}
        
        <Layout style={{ 
          marginLeft: isMobile ? 0 : (collapsed ? 80 : 200), 
          transition: 'all 0.2s' 
        }}>
          <Header
            style={{
              padding: isMobile ? '0 16px' : '0 24px',
              background: isDarkMode ? '#1f1f1f' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              position: 'sticky',
              top: 0,
              zIndex: 99,
              height: 64,
            }}
          >
            <Space>
              <Button
                type="text"
                icon={collapsed || isMobile ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => {
                  if (isMobile) {
                    setMobileDrawerVisible(true);
                  } else {
                    setCollapsed(!collapsed);
                  }
                }}
                style={{
                  fontSize: '16px',
                  width: isMobile ? 40 : 64,
                  height: isMobile ? 40 : 64,
                }}
              />
            </Space>

            <Space size={isMobile ? 'small' : 'middle'}>
              <Switch
                checkedChildren={<MoonOutlined />}
                unCheckedChildren={<SunOutlined />}
                checked={isDarkMode}
                onChange={toggleTheme}
                size={isMobile ? 'small' : 'default'}
              />
              
              <NotificationDropdown isMobile={isMobile} />

              <Dropdown 
                menu={{ items: userMenuItems }} 
                placement="bottomRight"
                trigger={['click']}
              >
                <Space style={{ cursor: 'pointer' }} size={4}>
                  <Avatar
                    style={{
                      backgroundColor: token.colorPrimary,
                      verticalAlign: 'middle',
                    }}
                    size={isMobile ? 'small' : 'default'}
                  >
                    {session.user?.email?.[0]?.toUpperCase() || 'U'}
                  </Avatar>
                  {!isMobile && (
                    <span style={{ 
                      fontWeight: 500,
                      fontSize: 14,
                    }}>
                      {session.user?.email?.split('@')[0]}
                    </span>
                  )}
                </Space>
              </Dropdown>
            </Space>
          </Header>

          <Content
            style={{
              margin: isMobile ? '12px' : '24px',
              minHeight: 280,
            }}
          >
            {breadcrumbs.length > 0 && !isMobile && (
              <Breadcrumb
                items={breadcrumbItems}
                style={{ marginBottom: 16 }}
              />
            )}
            <div
              style={{
                background: isDarkMode ? '#1f1f1f' : '#fff',
                borderRadius: 8,
                padding: isMobile ? '12px' : '24px',
                minHeight: '100%',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
              }}
            >
              {children}
            </div>
          </Content>
        </Layout>
      </Layout>
  );
}