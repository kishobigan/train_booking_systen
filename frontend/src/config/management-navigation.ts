import {
  LayoutDashboard,
  MapPin,
  Route,
  TrainFront,
  Ticket,
  Users,
  Banknote,
  ChartNoAxesCombined,
  CreditCard,
  ScrollText,
  ListTodo,
} from 'lucide-react';
import { PERMISSIONS as P, Permission } from '@/constants/permissions';
export type ManagementNavItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
  anyOf?: Permission[];
};
export const managementNavigation: ManagementNavItem[] = [
  {
    label: 'Dashboard',
    href: '/management/dashboard',
    icon: LayoutDashboard,
    anyOf: [P.DASHBOARD_VIEW_SYSTEM, P.DASHBOARD_VIEW_JOURNEY, P.DASHBOARD_VIEW_STATION],
  },
  { label: 'Trains', href: '/management/trains', icon: TrainFront, permission: P.TRAIN_VIEW },
  { label: 'Stations', href: '/management/stations', icon: MapPin, permission: P.STATION_VIEW },
  { label: 'Routes', href: '/management/routes', icon: Route, permission: P.ROUTE_VIEW },
  { label: 'Journeys', href: '/management/journeys', icon: TrainFront, permission: P.JOURNEY_VIEW },
  { label: 'Bookings', href: '/management/bookings', icon: Ticket, permission: P.BOOKING_VIEW },
  { label: 'Payments', href: '/management/payments', icon: CreditCard, permission: P.PAYMENT_VIEW },
  { label: 'Waitlist', href: '/management/waitlist', icon: ListTodo, permission: P.WAITLIST_VIEW },
  { label: 'Users', href: '/management/users', icon: Users, permission: P.USER_VIEW },
  {
    label: 'Revenue',
    href: '/management/reports/revenue',
    icon: Banknote,
    permission: P.REPORT_REVENUE_VIEW,
  },
  {
    label: 'Occupancy',
    href: '/management/reports/occupancy',
    icon: ChartNoAxesCombined,
    permission: P.REPORT_OCCUPANCY_VIEW,
  },
  { label: 'Audit', href: '/management/audit', icon: ScrollText, permission: P.AUDIT_VIEW },
];
