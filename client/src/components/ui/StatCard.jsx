export default function StatCard({ title, value, icon: Icon, color = 'purple', change }) {
  const colorMap = {
    purple: 'bg-purple-100 text-purple-600',
    green:  'bg-green-100 text-green-600',
    blue:   'bg-blue-100 text-blue-600',
    red:    'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-600',
  };

  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colorMap[color]}`}>
        <Icon size={22} />
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {change && (
          <p className={`text-xs mt-1 font-medium ${
            change.startsWith('+') ? 'text-green-600' : 'text-red-500'
          }`}>
            {change} vs last month
          </p>
        )}
      </div>
    </div>
  );
}
