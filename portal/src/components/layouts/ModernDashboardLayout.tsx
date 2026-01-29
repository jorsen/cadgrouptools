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
  Input,
  Spin,
  Drawer,
} from 'antd';
import {
  DashboardOutlined,
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
  SearchOutlined,
  BarChartOutlined,
  MonitorOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';

const { Header, Sider, Content } = Layout;

interface DashboardLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: Array<{ title: string; href?: string }>;
}

export default function ModernDashboardLayout({ children, breadcrumbs = [] }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDrawerVisible, setMobileDrawerVisible] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setMobileDrawerVisible(false);
  }, [pathname]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  const menuItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      onClick: () => router.push('/dashboard'),
    },
    {
      key: 'proposals',
      icon: <FileTextOutlined />,
      label: 'Proposals',
      children: [
        {
          key: '/proposals',
          label: 'All Proposals',
          onClick: () => router.push('/proposals'),
        },
        {
          type: 'divider',
        },
        {
          key: '/proposals/esystems',
          label: 'E-Systems Management',
          onClick: () => router.push('/proposals/esystems'),
        },
        {
          key: '/proposals/murphy',
          label: 'Murphy Consulting',
          onClick: () => router.push('/proposals/murphy'),
        },
        {
          type: 'divider',
        },
        {
          key: '/proposals/personas',
          label: '🤖 AI Personas',
          onClick: () => router.push('/proposals/personas'),
        },
        {
          key: '/proposals/clients',
          label: '👥 Clients',
          onClick: () => router.push('/proposals/clients'),
        },
      ],
    },
    {
      key: 'accounting',
      icon: <CalculatorOutlined />,
      label: 'Accounting',
      children: [
        {
          key: '/accounting-manus',
          label: 'Upload Documents',
          onClick: () => router.push('/accounting-manus'),
        },
        {
          type: 'divider',
        },
        {
          key: 'companies',
          label: 'Companies',
          type: 'group',
          children: [
            {
              key: '/accounting-manus/murphy_web_services',
              label: 'Murphy Web Services',
              onClick: () => router.push('/accounting-manus/murphy_web_services'),
            },
            {
              key: '/accounting-manus/esystems_management',
              label: 'E-Systems Management',
              onClick: () => router.push('/accounting-manus/esystems_management'),
            },
          ],
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
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => router.push('/settings'),
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
      label: 'Logout',
      onClick: async () => {
        await signOut({ redirect: false });
        window.location.href = '/auth/signin';
      },
      danger: true,
    },
  ];

  const themeMenuItems: MenuProps['items'] = [
    {
      key: 'light',
      icon: <SunOutlined />,
      label: 'Light',
      onClick: () => setTheme('light'),
    },
    {
      key: 'dark',
      icon: <MoonOutlined />,
      label: 'Dark',
      onClick: () => setTheme('dark'),
    },
    {
      key: 'system',
      icon: <MonitorOutlined />,
      label: 'System',
      onClick: () => setTheme('system'),
    },
  ];

  const getSelectedKeys = () => {
    if (pathname.startsWith('/proposals/murphy')) return ['/proposals/murphy'];
    if (pathname.startsWith('/proposals/esystems')) return ['/proposals/esystems'];
    if (pathname.startsWith('/proposals')) return ['/proposals'];
    if (pathname.startsWith('/accounting-manus/')) {
      const company = pathname.split('/')[2];
      return [`/accounting-manus/${company}`];
    }
    if (pathname.startsWith('/accounting-manus')) return ['/accounting-manus'];
    return [pathname];
  };

  const getOpenKeys = () => {
    if (pathname.startsWith('/proposals')) return ['proposals'];
    if (pathname.startsWith('/accounting')) return ['accounting'];
    return [];
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center p-4 border-b border-[var(--border-primary)]">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xl font-bold text-gradient"
          >
            CAD Group
          </motion.div>
        )}
        {collapsed && (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold">
            CG
          </div>
        )}
      </div>
      
      <Menu
        mode="inline"
        selectedKeys={getSelectedKeys()}
        defaultOpenKeys={getOpenKeys()}
        items={menuItems}
        inlineCollapsed={collapsed}
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
        }}
      />
      
      {!collapsed && (
        <div className="p-4 border-t border-[var(--border-primary)]">
          <div className="text-xs text-[var(--text-tertiary)] text-center">
            v1.0.0
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Layout className="min-h-screen">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={280}
          collapsedWidth={80}
          trigger={null}
          style={{
            background: 'var(--bg-elevated)',
            borderRight: '1px solid var(--border-primary)',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            overflow: 'auto',
            zIndex: 1000,
          }}
        >
          <SidebarContent />
        </Sider>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          open={mobileDrawerVisible}
          onClose={() => setMobileDrawerVisible(false)}
          width={280}
          styles={{ body: { padding: 0 } }}
        >
          <SidebarContent />
        </Drawer>
      )}

      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 80 : 280,
          transition: 'margin-left 0.2s ease',
          minHeight: '100vh',
        }}
      >
        {/* Top Header Bar */}
        <Header
          style={{
            background: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-primary)',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Mobile Menu Toggle */}
          {isMobile && (
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setMobileDrawerVisible(true)}
              style={{ fontSize: '18px' }}
            />
          )}

          {/* Desktop Collapse Toggle */}
          {!isMobile && (
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '18px' }}
            />
          )}

          {/* Global Search */}
          <div className="flex-1 max-w-2xl hidden md:block">
            <Input
              placeholder="Search proposals, clients, documents..."
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              size="large"
              style={{
                borderRadius: '24px',
                background: 'var(--bg-secondary)',
              }}
            />
          </div>

          <div className="flex-1 md:hidden" />

          {/* Right Actions */}
          <Space size="middle">
            {/* Theme Toggle */}
            <Dropdown menu={{ items: themeMenuItems, selectedKeys: [theme] }} trigger={['click']}>
              <Button
                type="text"
                icon={resolvedTheme === 'dark' ? <MoonOutlined /> : <SunOutlined />}
                style={{ fontSize: '18px' }}
              />
            </Dropdown>

            {/* Notifications */}
            <NotificationDropdown />

            {/* User Menu */}
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
              <div style={{ cursor: 'pointer' }}>
                <Space>
                  <Avatar
                    src={session?.user?.image}
                    icon={<UserOutlined />}
                    style={{
                      background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    }}
                  />
                  {!isMobile && (
                    <div style={{ lineHeight: '20px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {session?.user?.name || 'User'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        {session?.user?.role || 'Staff'}
                      </div>
                    </div>
                  )}
                </Space>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* Main Content */}
        <Content
          style={{
            padding: '24px',
            background: 'var(--bg-primary)',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </Content>
      </Layout>
    </Layout>
  );
}

