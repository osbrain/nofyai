'use client';

import { useState } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LoginModal } from '@/components/auth/LoginModal';
import { useAuth } from '@/hooks/useAuth';
import { useTranslations } from '@/lib/i18n-context';

export function Header() {
  const t = useTranslations();
  const { isAuthenticated, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      <div className="w-full px-4 md:px-6">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center text-xl md:text-2xl shadow-lg">
              ⚡
            </div>
            <div>
              <h1 className="text-base md:text-xl font-bold text-primary">
                NofyAI
              </h1>
              <p className="text-[10px] md:text-xs text-text-secondary hidden sm:block">
                AI Trading System
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="flex items-center gap-2 md:gap-4">
            <nav className="hidden md:flex items-center gap-6">
              <a href="/" className="text-sm font-medium text-text-secondary hover:text-primary transition-colors">
                {t.nav.traders}
              </a>
              <a href="/config" className="text-sm font-medium text-text-secondary hover:text-primary transition-colors">
                {t.nav.config}
              </a>
              <a href="#" className="text-sm font-medium text-text-secondary hover:text-primary transition-colors">
                {t.nav.documentation}
              </a>
            </nav>

            {/* Language Switcher - Desktop */}
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>

            {/* Auth Status & Login/Logout */}
            <div className="flex items-center gap-1.5 md:gap-2 pl-2 border-l border-border">
              {isAuthenticated ? (
                <>
                  {/* Logged In Status */}
                  <div className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-success/10 rounded-lg">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-success animate-pulse"></div>
                    <span className="text-[10px] md:text-xs font-semibold text-success">{t.auth.admin}</span>
                  </div>
                  {/* Logout Button */}
                  <button
                    onClick={handleLogout}
                    className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm font-medium text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                  >
                    {t.nav.logout}
                  </button>
                </>
              ) : (
                <>
                  {/* Not Logged In Status - Hide on mobile */}
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-text-tertiary/10 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-text-tertiary"></div>
                    <span className="text-xs font-semibold text-text-tertiary">{t.auth.guest}</span>
                  </div>
                  {/* Login Button */}
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="px-2 md:px-3 py-1 md:py-1.5 text-xs md:text-sm font-medium text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                  >
                    {t.nav.login}
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden ml-2 p-2 text-text-secondary hover:text-primary transition-colors"
              aria-label="Toggle menu"
            >
              {showMobileMenu ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="md:hidden py-3 border-t border-border">
            <nav className="flex flex-col space-y-3">
              <a
                href="/"
                className="text-sm font-medium text-text-secondary hover:text-primary transition-colors py-2"
                onClick={() => setShowMobileMenu(false)}
              >
                {t.nav.traders}
              </a>
              <a
                href="/config"
                className="text-sm font-medium text-text-secondary hover:text-primary transition-colors py-2"
                onClick={() => setShowMobileMenu(false)}
              >
                {t.nav.config}
              </a>
              <a
                href="#"
                className="text-sm font-medium text-text-secondary hover:text-primary transition-colors py-2"
                onClick={() => setShowMobileMenu(false)}
              >
                {t.nav.documentation}
              </a>

              {/* Language Switcher - Mobile */}
              <div className="pt-2 border-t border-border">
                <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
                  Language / 语言
                </div>
                <LanguageSwitcher showBackground={false} />
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={() => {
          setShowLoginModal(false);
          window.location.reload();
        }}
      />
    </header>
  );
}
