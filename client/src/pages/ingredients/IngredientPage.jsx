// client/src/pages/ingredients/IngredientsPage.jsx
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import { fetchIngredients, deleteIngredient } from '../../features/ingredients/ingredientSlice';
import IngredientModal from '../../components/ingredients/IngredientModal';
import Badge from '../../components/ui/Badge';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';

const CATEGORY_COLORS = {
  fish: 'blue', meat: 'red', vegetable: 'green',
  grain: '#f1c205', dairy: 'purple', spice: 'orange', other: 'gray',
};

export default function IngredientsPage() {
  const dispatch = useDispatch();
  const { items, loading } = useSelector((state) => state.ingredients);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create mode

  useEffect(() => {
    dispatch(fetchIngredients());
  }, [dispatch]);

  const handleEdit = (ingredient) => {
    setEditTarget(ingredient);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditTarget(null);
    setModalOpen(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Deactivate this ingredient?')) {
      dispatch(deleteIngredient(id));
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Menu</h1>
          <p className="text-sm text-gray-500 mt-1">
            Total menu items: {items.length}
          </p>
        </div>
        <button onClick={handleAdd} className="btn-primary flex items-center gap-2">
          <FiPlus /> Add Item
        </button>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <EmptyState message="No ingredients added yet" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Price (₹)</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4">Last Updated</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                console.log(item.category),
                <tr key={item._id} className="border-b hover:bg-gray-50 transition">
                  <td className="py-3 px-4 font-medium text-gray-800">{item.name}</td>
                  <td className="py-3 px-4">
                    <span style={{ backgroundColor: CATEGORY_COLORS[item.category] }} className="capitalize text-xs px-3 py-1.5 text-white rounded-md">{item.category}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">per {item.unit}</td>
                  <td className="py-3 px-4 font-semibold text-green-700">
                    ₹{item.pricePerUnit.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs max-w-[180px] truncate">
                    {item.notes || '—'}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">
                    {new Date(item.updatedAt).toLocaleDateString('en-IN')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <FiEdit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(item._id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <IngredientModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editTarget={editTarget}
      />
    </div>
  );
}
