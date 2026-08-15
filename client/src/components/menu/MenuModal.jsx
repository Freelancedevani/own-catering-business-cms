import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import Modal from '../ui/Modal';
import InputField from '../forms/InputField';
import SelectField from '../forms/SelectField';
import { createMenuItem, updateMenuItem } from '../../features/menu/menuSlice';

const schema = yup.object({
  name:         yup.string().min(2).max(100).required('Name is required'),
  category:     yup.string().required('Category is required'),
  unit:         yup.string().required('Unit is required'),
  pricePerUnit: yup.number().typeError('Price is required').min(0, 'Must be positive').required('Price is required'),
  notes:        yup.string().max(500).optional(),
});

const CATEGORY_OPTIONS = [
  { value: 'starter',    label: '🥗 Starter'     },
  { value: 'maincourse', label: '🍛 Main Course'  },
  { value: 'dessert',    label: '🍮 Dessert'      },
];

const UNIT_OPTIONS = [
  { value: 'plate',  label: 'Plate'  },
  { value: 'piece',  label: 'Piece'  },
  { value: 'bowl',   label: 'Bowl'   },
  { value: 'glass',  label: 'Glass'  },
  { value: 'kg',     label: 'kg'     },
  { value: 'litre',  label: 'Litre'  },
];

export default function MenuModal({ isOpen, onClose, editTarget }) {
  const dispatch = useDispatch();
  const { submitting } = useSelector((s) => s.menu);
  const isEdit = !!editTarget;

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { name: '', category: 'maincourse', unit: 'plate', pricePerUnit: '', notes: '' },
  });

  useEffect(() => {
    if (editTarget) {
      reset({
        name:         editTarget.name,
        category:     editTarget.category,
        unit:         editTarget.unit         || 'plate',
        pricePerUnit: editTarget.pricePerUnit,
        notes:        editTarget.notes        || '',
      });
    } else {
      reset({ name: '', category: 'maincourse', unit: 'plate', pricePerUnit: '', notes: '' });
    }
  }, [editTarget, reset, isOpen]);

  const onSubmit = async (data) => {
    const result = isEdit
      ? await dispatch(updateMenuItem({ id: editTarget._id, formData: data }))
      : await dispatch(createMenuItem(data));
    if (!result.error) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Menu Item' : 'Add Menu Item'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        <InputField label="Item Name" name="name" register={register} error={errors.name}
            placeholder="e.g. Vetki Fry, Chicken Curry" required />

        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Category" name="category" register={register}
            error={errors.category} options={CATEGORY_OPTIONS} />
          <SelectField label="Unit" name="unit" register={register}
            error={errors.unit} options={UNIT_OPTIONS} />
        </div>

        <InputField label="Price per Serving (₹)" name="pricePerUnit" register={register}
          error={errors.pricePerUnit} type="number" step="0.01" placeholder="e.g. 120" required />

        <InputField label="Notes (optional)" name="notes" register={register}
          error={errors.notes} placeholder="e.g. Seasonal item, price may vary" />

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Saving...' : isEdit ? 'Update Item' : 'Add Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
