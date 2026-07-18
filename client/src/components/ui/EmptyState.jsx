import { FiInbox } from 'react-icons/fi';

export default function EmptyState({ title = 'No data found', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FiInbox size={48} className="text-gray-300 mb-4" />
      <h3 className="text-lg font-semibold text-gray-600">{title}</h3>
      {description && <p className="text-sm text-gray-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
