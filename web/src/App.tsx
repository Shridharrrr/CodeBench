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
    <div class="min-h-screen bg-[#f4f5f7] dark:bg-[#090a0c] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans select-none transition-colors duration-100">
      {/* Top Header Navigation: Classic Workstation Status Bar */}
      <header class="h-12 border-b border-[#d4d6dc] dark:border-[#262a32] bg-white dark:bg-[#111316] px-5 flex items-center justify-between sticky top-0 z-40">
        <div class="flex items-center gap-5">
          <div
            class="flex items-center gap-2 cursor-pointer group"
            onClick={() => setViewMode('home')}
          >
            <div class="w-6 h-6 rounded-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center font-mono font-black text-xs border border-zinc-700 dark:border-zinc-300 shadow-[1px_1px_0px_rgba(0,0,0,0.2)]">
              CB
            </div>
            <span class="font-mono font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">
              CODEBENCH
            </span>
            <span class="hidden sm:inline-block font-mono text-[9px] px-1.5 py-0.5 rounded-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
              v1.0
            </span>
          </div>

          {/* Clean Classic Navigation Tabs */}
          <nav class="flex items-center bg-[#eaecf0] dark:bg-[#181a20] p-0.5 rounded-[2px] border border-[#d4d6dc] dark:border-[#272b34] font-medium text-xs">
            <button
              onClick={() => setViewMode('home')}
              class={`px-3 py-1 rounded-[2px] transition ${
                viewMode() === 'home'
                  ? 'bg-white dark:bg-[#232731] text-zinc-900 dark:text-white font-semibold shadow-[1px_1px_0px_rgba(0,0,0,0.06)]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setViewMode('contest')}
              class={`px-3 py-1 rounded-[2px] transition ${
                viewMode() === 'contest'
                  ? 'bg-white dark:bg-[#232731] text-zinc-900 dark:text-white font-semibold shadow-[1px_1px_0px_rgba(0,0,0,0.06)]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Arena
            </button>
            <button
              onClick={() => setViewMode('teams')}
              class={`px-3 py-1 rounded-[2px] transition ${
                viewMode() === 'teams'
                  ? 'bg-white dark:bg-[#232731] text-zinc-900 dark:text-white font-semibold shadow-[1px_1px_0px_rgba(0,0,0,0.06)]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Squads
            </button>
            <button
              onClick={() => setViewMode('scoreboard')}
              class={`px-3 py-1 rounded-[2px] transition ${
                viewMode() === 'scoreboard'
                  ? 'bg-white dark:bg-[#232731] text-zinc-900 dark:text-white font-semibold shadow-[1px_1px_0px_rgba(0,0,0,0.06)]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Scoreboard
            </button>
            <Show when={user()?.role === 'admin'}>
              <button
                onClick={() => setViewMode('admin')}
                class={`px-3 py-1 rounded-[2px] transition ${
                  viewMode() === 'admin'
                    ? 'bg-zinc-900 dark:bg-blue-600 text-white font-semibold shadow-[1px_1px_0px_rgba(0,0,0,0.1)]'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Admin
              </button>
            </Show>
          </nav>
        </div>

        <div class="flex items-center gap-3">
          {/* Theme Changing Toggle */}
          <button
            onClick={toggleTheme}
            title={theme() === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            class="px-2.5 py-1 rounded-[2px] text-xs font-mono text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#ebedf1] dark:hover:bg-[#1c1f26] transition flex items-center gap-1.5 border border-[#d4d6dc] dark:border-[#272b34]"
          >
            <Show when={theme() === 'dark'} fallback={<IconMoon class="w-3.5 h-3.5" />}>
              <IconSun class="w-3.5 h-3.5 text-amber-400" />
            </Show>
            <span class="text-[10px] uppercase font-bold">{theme()}</span>
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
                class="px-3.5 py-1 rounded-[2px] text-xs font-semibold bg-zinc-900 dark:bg-blue-600 hover:bg-zinc-800 dark:hover:bg-blue-500 text-white transition shadow-[1px_1px_0px_rgba(0,0,0,0.15)]"
              >
                Sign In
              </button>
            }
          >
            {(u) => (
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1.5 text-xs font-medium">
                  <span class="text-zinc-800 dark:text-zinc-200 font-semibold">{u().name}</span>
                  <span class="px-1.5 py-0.2 rounded-[2px] text-[10px] font-semibold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
                    {u().role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  class="px-2 py-0.5 rounded-[2px] text-xs text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 transition"
                >
                  Log out
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
        <div class="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div class="notion-card w-full max-w-sm p-6 shadow-[3px_3px_0px_rgba(0,0,0,0.25)] bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#2b303a]">
            <div class="flex items-center justify-between mb-4 pb-2.5 border-b border-[#eaecf0] dark:border-[#222630]">
              <h2 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {authMode() === 'login' ? 'Sign In to CodeBench' : 'Create an Account'}
              </h2>
              <button
                onClick={() => setIsAuthOpen(false)}
                class="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              >
                <IconX class="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div class="flex border-b border-[#d4d6dc] dark:border-[#272b34] mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                class={`flex-1 pb-2 border-b-2 transition ${
                  authMode() === 'login'
                    ? 'border-zinc-900 dark:border-blue-500 text-zinc-900 dark:text-zinc-100'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                class={`flex-1 pb-2 border-b-2 transition ${
                  authMode() === 'register'
                    ? 'border-zinc-900 dark:border-blue-500 text-zinc-900 dark:text-zinc-100'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} class="space-y-3">
              <Show when={authError()}>
                <div class="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2.5 rounded-[2px] text-xs text-rose-700 dark:text-rose-300">
                  {authError()}
                </div>
              </Show>

              <Show when={authMode() === 'register'}>
                <div>
                  <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Full Name</label>
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
                <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={authEmail()}
                  onInput={(e) => setAuthEmail(e.currentTarget.value)}
                  placeholder="user@example.com"
                  class="notion-input w-full text-xs"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
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
                  class="btn-workstation btn-workstation-primary w-full text-xs"
                >
                  {authSubmitting()
                    ? (authMode() === 'login' ? 'Signing in...' : 'Creating Account...')
                    : (authMode() === 'login' ? 'Sign In' : 'Create Account')}
                </button>
              </div>

              <div class="text-center pt-2 border-t border-[#eaecf0] dark:border-[#222630]">
                <Show when={authMode() === 'login'}>
                  <div class="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Sign in with your registered account credentials.
                  </div>
                </Show>
                <Show when={authMode() === 'register'}>
                  <div class="text-[11px] text-zinc-500 dark:text-zinc-400">
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
