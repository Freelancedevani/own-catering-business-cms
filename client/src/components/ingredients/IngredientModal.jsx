// client/src/components/ingredients/IngredientModal.jsx
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Modal from '../ui/Modal';
import InputField from '../forms/InputField';
import SelectField from '../forms/SelectField';
import { createIngredient, updateIngredient } from '../../features/ingredients/ingredientSlice';

const schema = yup.object({
  name:         yup.string().min(2).max(100).required('Name is required'),
  category:     yup.string().oneOf(['fish','meat','vegetable','grain','dairy','spice','other']),
  unit:         yup.string().oneOf(['piece','gram','kg','litre','ml']).required('Unit is required'),
  pricePerUnit: yup.number().typeError('Price is required').min(0, 'Must be positive').required('Price is required'),
  notes:        yup.string().max(500).optional(),
});

const UNIT_OPTIONS = [
  { value: 'piece', label: 'Piece' },
  { value: 'gram',  label: 'Gram' },
  { value: 'kg',    label: 'Kilogram (kg)' },
  { value: 'litre', label: 'Litre' },
  { value: 'ml',    label: 'Millilitre (ml)' },
];

const CATEGORY_OPTIONS = [
  { value: 'fish',      label: 'Fish' },
  { value: 'meat',      label: 'Meat' },
  { value: 'vegetable', label: 'Vegetable' },
  { value: 'grain',     label: 'Grain' },
  { value: 'dairy',     label: 'Dairy' },
  { value: 'spice',     label: 'Spice' },
  { value: 'other',     label: 'Other' },
];

export default function IngredientModal({ isOpen, onClose, editTarget }) {
  const dispatch = useDispatch();
  const { submitting } = useSelector((state) => state.ingredients);
  const isEdit = !!editTarget;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { name: '', category: 'other', unit: 'kg', pricePerUnit: '', notes: '' },
  });

  useEffect(() => {
    if (editTarget) {
      reset({
        name:         editTarget.name,
        category:     editTarget.category,
        unit:         editTarget.unit,
        pricePerUnit: editTarget.pricePerUnit,
        notes:        editTarget.notes || '',
      });
    } else {
      reset({ name: '', category: 'other', unit: 'kg', pricePerUnit: '', notes: '' });
    }
  }, [editTarget, reset, isOpen]);

  const onSubmit = async (data) => {
    const result = isEdit
      ? await dispatch(updateIngredient({ id: editTarget._id, formData: data }))
      : await dispatch(createIngredient(data));
    if (!result.error) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Update Ingredient Price' : 'Add New Ingredient'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* ✅ pass register + name as props — matches your InputField API */}
        <InputField
          label="Ingredient Name"
          name="name"
          register={register}
          error={errors.name}
          placeholder="e.g. Vetki, Rice, Chicken"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Category"
            name="category"
            register={register}
            error={errors.category}
            options={CATEGORY_OPTIONS}
          />
          <SelectField
            label="Unit"
            name="unit"
            register={register}
            error={errors.unit}
            options={UNIT_OPTIONS}
            required
          />
        </div>

        <InputField
          label="Price per Unit (₹)"
          name="pricePerUnit"
          register={register}
          error={errors.pricePerUnit}
          type="number"
          step="0.01"
          placeholder="e.g. 280"
          required
        />

        <InputField
          label="Notes (optional)"
          name="notes"
          register={register}
          error={errors.notes}
          placeholder="e.g. Market rate, updated weekly"
        />

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Saving...' : isEdit ? 'Update Price' : 'Add Ingredient'}
          </button>
        </div>

      </form>
    </Modal>
  );
}
