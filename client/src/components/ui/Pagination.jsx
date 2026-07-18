import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <p className="text-sm text-gray-500">
        Page <span className="font-medium">{page}</span> of{' '}
        <span className="font-medium">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-2 rounded-lg border border-gray-200 text-gray-600
                     hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FiChevronLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-2 rounded-lg border border-gray-200 text-gray-600
                     hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FiChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
