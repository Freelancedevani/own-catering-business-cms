import { useSelector, useDispatch } from 'react-redux';
import { logoutUser } from '../features/auth/authSlice';

export const useAuth = () => {
  const dispatch = useDispatch();
  const { user, isLoading } = useSelector((s) => s.auth);

  const logout = () => dispatch(logoutUser());
  const isAdmin = user?.role === 'admin';

  return { user, isLoading, logout, isAdmin };
};
