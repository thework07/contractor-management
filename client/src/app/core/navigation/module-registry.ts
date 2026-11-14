import {
  Building2,
  CalendarCheck,
  ChartNoAxesCombined,
  Cloud,
  CreditCard,
  FileText,
  LayoutDashboard,
  Users,
} from 'lucide-angular';

type ModuleId =
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'clients'
  | 'invoices'
  | 'payments'
  | 'drive'
  | 'organization'
  | 'users'
  | 'plan';

interface NavigationItem {
  id: ModuleId;
  label: string;
  icon: typeof LayoutDashboard;
  route?: string;
  enabled: boolean;
  comingSoon?: boolean;
}

interface NavigationGroup {
  label: string;
  items: readonly NavigationItem[];
}

export const MODULE_VISIBILITY: Record<ModuleId, boolean> = {
  dashboard: true,
  employees: true,
  attendance: true,
  clients: true,
  invoices: true,
  payments: true,
  drive: true,
  organization: true,
  users: true,
  plan: true,
};

export const MODULE_GROUPS: readonly NavigationGroup[] = [
  {
    label: '',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        route: '/',
        enabled: true,
      },
      { id: 'employees', label: 'Employees', icon: Users, route: '/employees', enabled: true },
      {
        id: 'attendance',
        label: 'Attendance & Salary',
        icon: CalendarCheck,
        route: '/attendance-salary',
        enabled: true,
      },
    ],
  },
  {
    label: 'Business',
    items: [
      { id: 'clients', label: 'Clients', icon: Building2, enabled: false, comingSoon: true },
      { id: 'invoices', label: 'Quotations & Invoices', icon: FileText, enabled: false, comingSoon: true },
      { id: 'payments', label: 'Payments & Expenses', icon: CreditCard, enabled: false, comingSoon: true },
    ],
  },
  {
    label: 'Settings',
    items: [
      { id: 'drive', label: 'Google Drive', icon: Cloud, enabled: false, comingSoon: true },
      {
        id: 'organization',
        label: 'Organization Settings',
        icon: Building2,
        enabled: false,
        comingSoon: true,
      },
      { id: 'users', label: 'User Management', icon: Users, enabled: false, comingSoon: true },
      { id: 'plan', label: 'Usage & Plan', icon: ChartNoAxesCombined, enabled: false, comingSoon: true },
    ],
  },
];
