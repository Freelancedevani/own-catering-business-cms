import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import { fetchMenuItems, deleteMenuItem } from '../../features/menu/menuSlice';
import MenuModal  from '../../components/menu/MenuModal';
import Loader     from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';

const CATEGORY_COLORS = {
  starter:    'bg-yellow-100 text-yellow-700',
  maincourse: 'bg-red-100 text-red-700',
  dessert:    'bg-pink-100 text-pink-700',
};
const CATEGORY_EMOJI = { starter: '🥗', maincourse: '🍛', dessert: '🍮' };

export default function MenuPage() {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((s) => s.menu);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  useEffect(() => { dispatch(fetchMenuItems()); }, [dispatch]);

  const handleEdit   = (item) => { setEditTarget(item); setModalOpen(true); };
  const handleAdd    = ()     => { setEditTarget(null); setModalOpen(true); };
  const handleDelete = (id)   => {
    if (window.confirm('Remove this menu item?')) dispatch(deleteMenuItem(id));
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Menu</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} items</p>
        </div>
        <button onClick={handleAdd} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <FiPlus size={16} /> Add Menu Item
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No menu items yet"
          description="Add your first menu item to get started"
          action={
            <button onClick={handleAdd} className="btn-primary">
              <FiPlus size={14} className="inline mr-1" /> Add Menu Item
            </button>
          }
        />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Code', 'Item Name', 'Category', 'Price per Serving', 'Notes', 'Last Updated', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-brand">{item.code || '—'}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full capitalize ${CATEGORY_COLORS[item.category] || 'bg-gray-100 text-gray-600'}`}>
                        {CATEGORY_EMOJI[item.category] || '🍽️'} {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-700">
                      ₹{item.pricePerUnit.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                      {item.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(item.updatedAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(item)}
                          className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-500 transition-colors" title="Edit">
                          <FiEdit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(item._id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Delete">
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <MenuModal isOpen={modalOpen} onClose={() => setModalOpen(false)} editTarget={editTarget} />
    </div>
  );
}
