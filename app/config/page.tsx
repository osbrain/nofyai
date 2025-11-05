'use client';

import Link from 'next/link';
import { ConfigViewer } from '@/components/config/ConfigViewer';

export default function ConfigPage() {
  return (
    <div className="min-h-screen bg-background-secondary">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="w-full px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-sm text-primary hover:underline flex items-center gap-2">
              <span>←</span>
              <span>Back to Competition</span>
            </Link>

            <div className="flex items-center gap-4">
              <div className="text-xs text-text-secondary">
                Read-only view
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue via-accent-purple to-accent-cyan flex items-center justify-center text-4xl shadow-lg">
              ⚙️
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text-primary">
                System Configuration
              </h1>
              <p className="text-text-secondary text-sm mt-1">
                View current system configuration and trader settings
              </p>
            </div>
          </div>
        </div>

        {/* Configuration Viewer */}
        <ConfigViewer />
      </main>
    </div>
  );
}
