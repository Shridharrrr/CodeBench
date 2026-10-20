import { createSignal, onMount, Show } from 'solid-js';
import LandingPage from './LandingPage';
import ContestArena from './ContestArena';
import TeamsPage from './TeamsPage';
import ScoreboardPage from './ScoreboardPage';
import AdminDashboard from './AdminDashboard';
import { IconX, IconSun, IconMoon } from './icons';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export default function App() {
  // Navigation & View Mode selection
  const [viewMode, setViewMode] = createSignal<'home' | 'contest' | 'teams' | 'scoreboard' | 'admin'>('home');

  // Auth & Session
  const [user, setUser] = createSignal<UserProfile | null>(null);
  const [csrfToken, setCsrfToken] = createSignal<string>('');
  const [isAuthOpen, setIsAuthOpen] = createSignal(false);
  const [authMode, setAuthMode] = createSignal<'login' | 'register'>('login');
  const [authName, setAuthName] = createSignal('');
  const [authEmail, setAuthEmail] = createSignal('');
  const [authPassword, setAuthPassword] = createSignal('');
  const [authError, setAuthError] = createSignal('');

  // Theme State
  const [theme, setTheme] = createSignal<'light' | 'dark'>('light');

  const applyTheme = (t: 'light' | 'dark') => {
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('codebench_theme', t);
  };

  const toggleTheme = () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  onMount(() => {
    // Initialize Theme
    const savedTheme = localStorage.getItem('codebench_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initialTheme);
    applyTheme(initialTheme);

    fetchSession();

    const path = window.location.pathname;
    if (path.startsWith('/admin')) {
      setViewMode('admin');
    } else if (path.startsWith('/teams')) {
      setViewMode('teams');
    } else if (path.startsWith('/scoreboard') || path.startsWith('/standings')) {
      setViewMode('scoreboard');
    } else if (path.startsWith('/arena') || path.startsWith('/contest')) {
      setViewMode('contest');
    } else {
      setViewMode('home');
    }
  });

  const [authSubmitting, setAuthSubmitting] = createSignal(false);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setCsrfToken(data.csrf_token);
      } else {
        setUser(null);
        setCsrfToken('');
      }
    } catch {
      setUser(null);
      setCsrfToken('');
    }
  };

  const handleAuthSubmit = async (e: Event) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);

    const endpoint = authMode() === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body: Record<string, string> = {
      email: authEmail().trim(),
      password: authPassword(),
    };
    if (authMode() === 'register') {
      body.name = authName().trim();
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Authentication failed' }));
        throw new Error(err.error || 'Authentication failed');
      }

      const data = await res.json();
      setUser(data.user);
      setCsrfToken(data.csrf_token);
      setIsAuthOpen(false);
      setAuthPassword('');
      setAuthEmail('');
      setAuthName('');
      setAuthError('');

      // Auto-navigate to admin if admin logged in from home view
      if (data.user?.role === 'admin' && viewMode() === 'home') {
        setViewMode('admin');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken(),
        },
      });
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      setUser(null);
      setCsrfToken('');
      if (viewMode() === 'admin') {
        setViewMode('home');
      }
      fetchSession();
    }
  };

  return (
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans select-none transition-colors duration-150">
      {/* Top Header Navigation */}
      <header class="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div class="flex items-center gap-4">
          <div
            class="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition"
            onClick={() => setViewMode('home')}
          >
            <div class="w-7 h-7 rounded-md bg-slate-900 dark:bg-slate-800 flex items-center justify-center font-bold text-white text-xs shadow-xs">
              CB
            </div>
            <span class="font-bold text-base tracking-tight text-slate-900 dark:text-slate-100">
              Codebench
            </span>
          </div>

          {/* Clean Segmented Navigation Switcher */}
          <div class="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('home')}
              class={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                viewMode() === 'home'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setViewMode('contest')}
              class={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                viewMode() === 'contest'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Contest Arena
            </button>
            <button
              onClick={() => setViewMode('teams')}
              class={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                viewMode() === 'teams'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Teams
            </button>
            <button
              onClick={() => setViewMode('scoreboard')}
              class={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                viewMode() === 'scoreboard'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Scoreboard
            </button>
            <Show when={user()?.role === 'admin'}>
              <button
                onClick={() => setViewMode('admin')}
                class={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                  viewMode() === 'admin'
                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Admin Control
              </button>
            </Show>
          </div>
        </div>

        <div class="flex items-center gap-3">
          {/* Theme Changing Toggle */}
          <button
            onClick={toggleTheme}
            title={theme() === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            class="p-2 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center border border-slate-200/60 dark:border-slate-800"
          >
            <Show when={theme() === 'dark'} fallback={<IconMoon class="w-4 h-4" />}>
              <IconSun class="w-4 h-4 text-amber-400" />
            </Show>
          </button>

          {/* User Profile / Auth Button */}
          <Show
            when={user()}
            fallback={
              <button
                onClick={() => {
                  setAuthMode('login');
                  setIsAuthOpen(true);
                }}
                class="px-4 py-1.5 rounded-md text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs"
              >
                Sign In
              </button>
            }
          >
            {(u) => (
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2 text-xs">
                  <div class="w-6 h-6 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-[10px]">
                    {u().name.charAt(0).toUpperCase()}
                  </div>
                  <span class="text-slate-800 dark:text-slate-200 font-medium">{u().name}</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {u().role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  class="px-2.5 py-1 rounded-md text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900/60 transition cursor-pointer"
                  title="Sign out of your account"
                >
                  Logout
                </button>
              </div>
            )}
          </Show>
        </div>
      </header>

      {/* Main Body Views */}
      <Show when={viewMode() === 'home'}>
        <LandingPage
          user={user()}
          onNavigate={(target) => setViewMode(target)}
          onOpenAuth={() => {
            setAuthMode('login');
            setIsAuthOpen(true);
          }}
        />
      </Show>

      <Show when={viewMode() === 'teams'}>
        <TeamsPage
          user={user()}
          csrfToken={csrfToken()}
          onOpenAuth={() => {
            setAuthMode('login');
            setIsAuthOpen(true);
          }}
        />
      </Show>

      <Show when={viewMode() === 'scoreboard'}>
        <ScoreboardPage />
      </Show>

      <Show when={viewMode() === 'contest'}>
        <ContestArena
          user={user()}
          csrfToken={csrfToken()}
          onOpenAuth={() => {
            setAuthMode('login');
            setIsAuthOpen(true);
          }}
        />
      </Show>

      <Show when={viewMode() === 'admin'}>
        <AdminDashboard csrfToken={csrfToken()} />
      </Show>

      {/* Auth Modal (Login / Register) */}
      <Show when={isAuthOpen()}>
        <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div class="notion-card w-full max-w-sm p-6 shadow-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div class="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">
                {authMode() === 'login' ? 'Sign In to Codebench' : 'Create an Account'}
              </h2>
              <button
                onClick={() => setIsAuthOpen(false)}
                class="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition"
              >
                <IconX class="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div class="flex border-b border-slate-200 dark:border-slate-800 mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                class={`flex-1 pb-2 border-b-2 transition ${
                  authMode() === 'login'
                    ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                class={`flex-1 pb-2 border-b-2 transition ${
                  authMode() === 'register'
                    ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} class="space-y-3">
              <Show when={authError()}>
                <div class="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2.5 rounded text-xs text-rose-700 dark:text-rose-300">
                  {authError()}
                </div>
              </Show>

              <Show when={authMode() === 'register'}>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={authName()}
                    onInput={(e) => setAuthName(e.currentTarget.value)}
                    placeholder="Participant Name"
                    class="notion-input w-full text-xs"
                  />
                </div>
              </Show>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={authEmail()}
                  onInput={(e) => setAuthEmail(e.currentTarget.value)}
                  placeholder="name@example.com"
                  class="notion-input w-full text-xs"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword()}
                  onInput={(e) => setAuthPassword(e.currentTarget.value)}
                  placeholder="••••••••"
                  class="notion-input w-full text-xs"
                />
              </div>

              <div class="pt-2">
                <button
                  type="submit"
                  disabled={authSubmitting()}
                  class="w-full py-2.5 rounded-md text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs disabled:opacity-50"
                >
                  {authSubmitting()
                    ? 'Processing...'
                    : authMode() === 'login'
                    ? 'Sign In'
                    : 'Create Account'}
                </button>
              </div>

              <div class="text-center pt-3 border-t border-slate-100 dark:border-slate-800">
                <Show when={authMode() === 'login'}>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400">
                    Sign in with your registered account credentials.
                  </div>
                </Show>
                <Show when={authMode() === 'register'}>
                  <div class="text-[11px] text-slate-500 dark:text-slate-400">
                    Registration creates a participant account with squad privileges.
                  </div>
                </Show>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
