import type { Environment } from './environment.model';

export const environment: Environment = {
  production: false,
  apiUrl: '/api',
  logLevel: 'debug',
  dashboardMockData: {
    stats: [
      { id: 'employees', label: 'Total employees', value: '128', note: '+12 this month' },
      { id: 'active', label: 'Active employees', value: '112', note: 'Across 8 active projects' },
      { id: 'uploads', label: 'Attendance uploads', value: '94', note: 'This month' },
      { id: 'pending', label: 'Pending verification', value: '12', note: 'Needs your attention' },
      { id: 'approved', label: 'Approved attendance', value: '82', note: '87% of submissions' },
      { id: 'salary', label: 'Monthly salary estimate', value: '₹18.4L', note: 'October payroll' },
    ],
    activity: [
      {
        action: 'Attendance uploaded',
        details: 'Rahul Sharma · North site',
        time: '12 min ago',
        status: 'Approved',
      },
      {
        action: 'Employee added',
        details: 'Rakesh Kumar · Field technician',
        time: '1 hr ago',
        status: 'Completed',
      },
      {
        action: 'Verification needed',
        details: 'October attendance · 3 entries',
        time: '2 hrs ago',
        status: 'Review',
      },
      {
        action: 'Salary estimate updated',
        details: 'October payroll',
        time: 'Yesterday',
        status: 'Updated',
      },
    ],
  },
};
