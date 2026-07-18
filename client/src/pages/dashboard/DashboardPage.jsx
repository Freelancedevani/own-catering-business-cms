import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDashboardData } from '../../features/dashboard/dashboardSlice';
import {
  FiUsers, FiShoppingBag, FiTrendingUp,
  FiDollarSign, FiClipboard, FiUserCheck,
  FiCalendar, FiArrowUpRight, FiArrowDownRight,
} from 'react-icons/fi';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import { formatCurrency, formatDate, capitalize } from '../../utils/formatters';
import { LEAD_STATUSES, ORDER_STATUSES, PAYMENT_STATUSES } from '../../utils/constants';
import Badge   from '../../components/ui/Badge';
import Loader  from '../../components/ui/Loader';

export default function DashboardPage() {
  const dispatch = useDispatch();
  const {
    orderStats, recentLeads, clientStats,
    staffStats, financeStats, isLoading,
  } = useSelector((s) => s.dashboard);

  useEffect(() => { dispatch(fetchDashboardData()); }, [dispatch]);

  if (isLoading) return <Loader />;

  const thisMonth  = financeStats?.thisMonth;
  const lastMonth  = financeStats?.lastMonth;
  const monthlyData = orderStats?.monthlyTrend?.map((m) => ({
    name:    `Month ${m._id}`,
    revenue: m.revenue,
    orders:  m.count,
  })) || [];

  // Handle recent leads data structure
  const recentLeadsData = recentLeads?.leads || recentLeads || [];

  return (
    <div className="space-y-6">

      {/* ── Welcome Banner ── */}
      <div className="bg-gradient-to-r from-brand to-primary-500 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold">Good day! 👋</h2>
        <p className="text-primary-100 text-sm mt-1">
          Here's what's happening with your catering business today.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="bg-white/20 rounded-xl px-4 py-2">
            <p className="text-primary-100 text-xs">This Month Revenue</p>
            <p className="font-bold text-lg">{formatCurrency(thisMonth?.income)}</p>
          </div>
          <div className="bg-white/20 rounded-xl px-4 py-2">
            <p className="text-primary-100 text-xs">Net Profit</p>
            <p className="font-bold text-lg">{formatCurrency(thisMonth?.profit)}</p>
          </div>
          <div className="bg-white/20 rounded-xl px-4 py-2">
            <p className="text-primary-100 text-xs">Total Orders</p>
            <p className="font-bold text-lg">{orderStats?.totalOrders || 0}</p>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(orderStats?.totalRevenue)}
          icon={FiTrendingUp}
          color="purple"
          change={thisMonth?.incomeGrowth}
        />
        <StatCard
          title="Total Orders"
          value={orderStats?.totalOrders || 0}
          icon={FiShoppingBag}
          color="blue"
        />
        <StatCard
          title="Active Clients"
          value={clientStats?.activeClients || 0}
          icon={FiUserCheck}
          color="green"
        />
        <StatCard
          title="Active Staff"
          value={staffStats?.total || 0}
          icon={FiUsers}
          color="yellow"
        />
      </div>

      {/* ── Finance Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FinanceCard
          title="Income This Month"
          value={formatCurrency(thisMonth?.income)}
          prev={formatCurrency(lastMonth?.income)}
          change={thisMonth?.incomeGrowth}
          positive={true}
        />
        <FinanceCard
          title="Expense This Month"
          value={formatCurrency(thisMonth?.expense)}
          prev={formatCurrency(lastMonth?.expense)}
          change={thisMonth?.expenseGrowth}
          positive={false}
        />
        <FinanceCard
          title="Net Profit"
          value={formatCurrency(thisMonth?.profit)}
          prev={formatCurrency(lastMonth?.profit)}
          positive={thisMonth?.profit >= 0}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Monthly Revenue & Orders
          </h3>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7e22ce" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#7e22ce" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => n === 'revenue' ? formatCurrency(v) : v} />
                <Area
                  type="monotone" dataKey="revenue" name="Revenue"
                  stroke="#7e22ce" fill="url(#colorRev)" strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>

        {/* Order Status Chart */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Orders by Status
          </h3>
          {orderStats?.byStatus?.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={orderStats.byStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Orders" fill="#a855f7" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Upcoming Events */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">
              Upcoming Events
            </h3>
            <span className="text-xs text-gray-400">Next 30 days</span>
          </div>
          {orderStats?.upcomingEvents?.length > 0 ? (
            <div className="space-y-3">
              {orderStats.upcomingEvents.map((event) => {
                const statusInfo = ORDER_STATUSES.find((s) => s.value === event.status);
                const payInfo    = PAYMENT_STATUSES.find((p) => p.value === event.paymentStatus);
                return (
                  <div key={event._id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center
                                    justify-center text-brand shrink-0">
                      <FiCalendar size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {event.eventName || capitalize(event.eventType)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(event.eventDate)} · {event.guestCount} guests
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge label={statusInfo?.label} color={statusInfo?.color} />
                      <Badge label={payInfo?.label}    color={payInfo?.color}    />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              No upcoming events in the next 30 days
            </p>
          )}
        </div>

        {/* Recent New Leads */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">
              Recent Leads
            </h3>
            <a href="/leads" className="text-xs text-brand hover:underline font-medium">
              View all →
            </a>
          </div>
          {recentLeadsData?.length > 0 ? (
            <div className="space-y-3">
              {recentLeadsData.map((lead) => {
                const statusInfo = LEAD_STATUSES.find((s) => s.value === lead.status);
                return (
                  <div key={lead._id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center
                                    justify-center text-blue-600 font-bold text-sm shrink-0">
                      {lead.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {lead.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {capitalize(lead.eventType)} · {formatDate(lead.eventDate)}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Badge label={statusInfo?.label} color={statusInfo?.color} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              No new leads yet
            </p>
          )}
        </div>

      </div>

      {/* ── Staff & Expense Breakdown ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Top Expense Categories */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Top Expenses This Month
          </h3>
          {financeStats?.topExpenseCategories?.length > 0 ? (
            <div className="space-y-3">
              {financeStats.topExpenseCategories.map((cat) => (
                <div key={cat._id} className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-red-400 rounded-full shrink-0" />
                  <p className="text-sm text-gray-700 flex-1 capitalize">
                    {cat._id?.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(cat.total)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No expenses this month</p>
          )}
        </div>

        {/* Staff Summary */}
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Staff Summary
          </h3>
          {staffStats?.byRole?.length > 0 ? (
            <div className="space-y-3">
              {staffStats.byRole.slice(0, 6).map((role) => (
                <div key={role._id} className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-400 rounded-full shrink-0" />
                  <p className="text-sm text-gray-700 flex-1 capitalize">
                    {role._id?.replace(/_/g, ' ')}
                  </p>
                  <span className="text-xs font-semibold bg-purple-100 text-purple-700
                                   px-2 py-0.5 rounded-full">
                    {role.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No staff added yet</p>
          )}
        </div>

      </div>

    </div>
  );
}

// ── Sub Components ──────────────────────────────

function StatCard({ title, value, icon: Icon, color, change }) {
  const colorMap = {
    purple: { bg: 'bg-purple-100', text: 'text-purple-600', icon: 'bg-brand text-white' },
    blue:   { bg: 'bg-blue-100',   text: 'text-blue-600',   icon: 'bg-blue-500 text-white' },
    green:  { bg: 'bg-green-100',  text: 'text-green-600',  icon: 'bg-green-500 text-white' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', icon: 'bg-yellow-500 text-white' },
  };
  const c = colorMap[color] || colorMap.purple;

  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${c.icon}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {change && (
          <p className={`text-xs mt-1 flex items-center gap-1 font-medium ${
            String(change).startsWith('+') ? 'text-green-600' : 'text-red-500'
          }`}>
            {String(change).startsWith('+')
              ? <FiArrowUpRight size={12} />
              : <FiArrowDownRight size={12} />
            }
            {change} vs last month
          </p>
        )}
      </div>
    </div>
  );
}

function FinanceCard({ title, value, prev, change, positive }) {
  return (
    <div className="card">
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${positive ? 'text-green-600' : 'text-red-500'}`}>
        {value}
      </p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-gray-400">Last month: {prev}</p>
        {change && (
          <p className={`text-xs font-semibold flex items-center gap-0.5 ${
            String(change).startsWith('+') ? 'text-green-600' : 'text-red-500'
          }`}>
            {String(change).startsWith('+')
              ? <FiArrowUpRight size={11} />
              : <FiArrowDownRight size={11} />
            }
            {change}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-60 flex items-center justify-center text-gray-300 text-sm">
      No data available yet
    </div>
  );
}
