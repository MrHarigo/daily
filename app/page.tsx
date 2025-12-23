'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useHabitStore } from '@/stores/habitStore';
import { useStatsStore } from '@/stores/statsStore';
import { Login } from '@/components/Login';
import { Dashboard } from '@/components/Dashboard';
import { Stats } from '@/components/Stats';
import { Settings } from '@/components/Settings';
import ErrorBoundary from '@/components/ErrorBoundary';

type Tab = 'today' | 'stats' | 'settings';

const IDLE_REFRESH_THRESHOLD_MS = 30_000;

export default function Home() {
  const { isAuthenticated, isLoading, checkAuth, logout, fetchDevices } = useAuthStore();
  const { fetchHabits } = useHabitStore();
  const { fetchStats } = useStatsStore();
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const lastRefreshRef = useRef<number>(0);
  const prevAuthenticatedRef = useRef<boolean>(false);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Reset to Today tab only when user logs in (false -> true transition)
  useEffect(() => {
    const wasAuthenticated = prevAuthenticatedRef.current;
    prevAuthenticatedRef.current = isAuthenticated;

    // Only reset tab when transitioning from logged out to logged in
    if (!wasAuthenticated && isAuthenticated) {
      setActiveTab('today');
    }
  }, [isAuthenticated]);

  // Refetch data for the current tab
  const refetchCurrentTab = useCallback(() => {
    if (!isAuthenticated) return;

    switch (activeTab) {
      case 'today':
        fetchHabits();
        break;
      case 'stats':
        fetchStats();
        break;
      case 'settings':
        fetchHabits();
        fetchDevices();
        break;
    }
  }, [activeTab, isAuthenticated, fetchHabits, fetchStats, fetchDevices]);

  // Refetch on visibility change (user returns from idle/background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        // Only refetch if more than 30 seconds since last refresh
        if (now - lastRefreshRef.current > IDLE_REFRESH_THRESHOLD_MS) {
          lastRefreshRef.current = now;
          refetchCurrentTab();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetchCurrentTab]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary
        fallbackTitle="Login Error"
        onReset={() => checkAuth()}
      >
        <Login />
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-surface-900/95 backdrop-blur border-b border-surface-700">
        <div className="max-w-5xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-xl font-bold text-accent">Daily</h1>
            <div className="flex items-center gap-1">
              {[
                { id: 'today' as const, label: 'Today', icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )},
                { id: 'stats' as const, label: 'Stats', icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                )},
                { id: 'settings' as const, label: 'Settings', icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )},
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`btn-press flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-accent/10 text-accent'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-surface-800'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
        {activeTab === 'today' && (
          <ErrorBoundary
            fallbackTitle="Dashboard Error"
            onReset={() => fetchHabits()}
          >
            <Dashboard />
          </ErrorBoundary>
        )}
        {activeTab === 'stats' && (
          <ErrorBoundary
            fallbackTitle="Stats Error"
            onReset={() => fetchStats()}
          >
            <Stats />
          </ErrorBoundary>
        )}
        {activeTab === 'settings' && (
          <ErrorBoundary
            fallbackTitle="Settings Error"
            onReset={() => {
              fetchHabits();
              fetchDevices();
            }}
          >
            <Settings onLogout={logout} />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
