import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser, clearError } from '../../features/auth/authSlice';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { useState } from 'react';

const schema = yup.object({
  email:    yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().required('Password is required'),
});

export default function LoginPage() {
  const dispatch          = useDispatch();
  const { isLoading, error } = useSelector((s) => s.auth);
  const [showPass, setShowPass] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema) });

  useEffect(() => {
    return () => dispatch(clearError());
  }, [dispatch]);

  const onSubmit = (data) => dispatch(loginUser(data));

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-purple-50
                    flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ── Card ── */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-brand rounded-2xl flex items-center
                            justify-center shadow-lg mb-4">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">CaterCMS</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to your dashboard</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200
                            rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <FiMail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  placeholder="admin@catering.com"
                  className={`input-field pl-9 ${errors.email ? 'border-red-400' : ''}`}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <FiLock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className={`input-field pl-9 pr-10 ${errors.password ? 'border-red-400' : ''}`}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                             hover:text-gray-600 transition-colors"
                >
                  {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent
                                  rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-gray-400 mt-6">
            CaterCMS © {new Date().getFullYear()} — All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}
