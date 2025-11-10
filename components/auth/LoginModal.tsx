'use client';

// ========================================
// Login Modal Component
// ========================================
// 密码输入模态框

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslations } from '@/lib/i18n-context';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const t = useTranslations();
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(password);

    if (result.success) {
      setPassword('');
      onSuccess?.();
      onClose();
    } else {
      setError(result.error || t.auth.loginFailed);
    }

    setIsLoading(false);
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background-secondary border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-text-primary">🔐 {t.auth.loginTitle}</h2>
          <button
            onClick={handleClose}
            className="text-text-tertiary hover:text-text-primary transition-colors"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm text-text-secondary mb-2">
              {t.auth.passwordLabel}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-background-primary border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              placeholder={t.auth.passwordPlaceholder}
              autoFocus
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-sm text-danger">
              {error}
            </div>
          )}

          {/* Info */}
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-text-secondary">
            {t.auth.loginInfo}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-background-primary border border-border rounded-lg text-text-secondary hover:bg-background-secondary transition-colors"
              disabled={isLoading}
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || !password}
            >
              {isLoading ? t.auth.loggingIn : t.auth.loginButton}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
