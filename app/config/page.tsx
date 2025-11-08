'use client';

import { ConfigViewer } from '@/components/config/ConfigViewer';

export default function ConfigPage() {
  return (
    <div className="w-full px-6 py-8">
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
    </div>
  );
}
