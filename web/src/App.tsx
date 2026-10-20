import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import LandingPage from './LandingPage';
import ContestArena from './ContestArena';
import TeamsPage from './TeamsPage';
import ScoreboardPage from './ScoreboardPage';
import AdminDashboard from './AdminDashboard';
import ShortcutsModal from './ShortcutsModal';
import { SystemHeartbeatPill, ButtonSpinner } from './Loaders';
import { IconX, IconSun, IconMoon, IconKeyboard } from './icons';

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
  const [authSubmitting, setAuthSubmitting] = createSignal(false);

  // Modals state
  const [isShortcutsOpen, setIsShortcutsOpen] = createSignal(false);

  // Theme & CRT Scanline State
  const [theme, setTheme] = createSignal<'light' | 'dark'>('light');
  const [crtEnabled, setCrtEnabled] = createSignal<boolean>(false);

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

  const toggleCrt = () => {
    const next = !crtEnabled();
    setCrtEnabled(next);
    if (next) {
      document.body.classList.add('crt-active');
    } else {
      document.body.classList.remove('crt-active');
    }
    localStorage.setItem('codebench_crt', next ? 'true' : 'false');
  };

  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isEditing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    if (e.key === 'Escape') {
      setIsAuthOpen(false);
      setIsShortcutsOpen(false);
      return;
    }

    if (isEditing) return;

    if (e.key === '1') setViewMode('home');
    else if (e.key === '2') setViewMode('contest');
    else if (e.key === '3') setViewMode('teams');
    else if (e.key === '4') setViewMode('scoreboard');
    else if (e.key === '5' && user()?.role === 'admin') setViewMode('admin');
    else if (e.key === 't' || e.key === 'T') {
      toggleTheme();
    } else if (e.key === 'c' || e.key === 'C') {
      toggleCrt();
    } else if (e.key === '?') {
      setIsShortcutsOpen(!isShortcutsOpen());
    }
  };

  onMount(() => {
    // Initialize Theme
    const savedTheme = localStorage.getItem('codebench_theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initialTheme);
    applyTheme(initialTheme);

    // Initialize CRT
    const savedCrt = localStorage.getItem('codebench_crt') === 'true';
    if (savedCrt) {
      setCrtEnabled(true);
      document.body.classList.add('crt-active');
    }

    window.addEventListener('keydown', handleGlobalKeyDown);

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

    onCleanup(() => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    });
  });

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
      <header class="h-12 border-b border-[#d4d6dc] dark:border-[#262a32] bg-white dark:bg-[#111316] px-3 sm:px-5 flex items-center justify-between sticky top-0 z-40 gap-2">
        <div class="flex items-center gap-2 sm:gap-4 min-w-0">
          <div
            class="flex items-center gap-2 cursor-pointer group shrink-0"
            onClick={() => setViewMode('home')}
          >
            <div class="w-6 h-6 rounded-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center font-mono font-black text-xs border border-zinc-700 dark:border-zinc-300 shadow-[1px_1px_0px_rgba(0,0,0,0.2)]">
              CB
            </div>
            <span class="font-mono font-bold text-xs sm:text-sm tracking-tight text-zinc-900 dark:text-zinc-100 hidden xs:inline-block">
              CODEBENCH
            </span>
          </div>

          {/* Clean Classic Navigation Tabs (Scrollable on small viewports) */}
          <nav class="flex items-center bg-[#eaecf0] dark:bg-[#181a20] p-0.5 rounded-[2px] border border-[#d4d6dc] dark:border-[#272b34] font-medium text-xs overflow-x-auto no-scrollbar shrink">
            <button
              onClick={() => setViewMode('home')}
              class={`px-2.5 sm:px-3 py-1 rounded-[2px] transition shrink-0 ${
                viewMode() === 'home'
                  ? 'bg-white dark:bg-[#232731] text-zinc-900 dark:text-white font-semibold shadow-[1px_1px_0px_rgba(0,0,0,0.06)]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => setViewMode('contest')}
              class={`px-2.5 sm:px-3 py-1 rounded-[2px] transition shrink-0 ${
                viewMode() === 'contest'
                  ? 'bg-white dark:bg-[#232731] text-zinc-900 dark:text-white font-semibold shadow-[1px_1px_0px_rgba(0,0,0,0.06)]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Arena
            </button>
            <button
              onClick={() => setViewMode('teams')}
              class={`px-2.5 sm:px-3 py-1 rounded-[2px] transition shrink-0 ${
                viewMode() === 'teams'
                  ? 'bg-white dark:bg-[#232731] text-zinc-900 dark:text-white font-semibold shadow-[1px_1px_0px_rgba(0,0,0,0.06)]'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Squads
            </button>
            <button
              onClick={() => setViewMode('scoreboard')}
              class={`px-2.5 sm:px-3 py-1 rounded-[2px] transition shrink-0 ${
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
                class={`px-2.5 sm:px-3 py-1 rounded-[2px] transition shrink-0 ${
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

        <div class="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Live System Heartbeat & Telemetry Monitor */}
          <div class="hidden sm:inline-flex">
            <SystemHeartbeatPill />
          </div>

          {/* CRT Scanline Toggle */}
          <button
            onClick={toggleCrt}
            title="Toggle Retro CRT Scanline Overlay (C)"
            class={`hidden md:inline-flex px-2 py-1 rounded-[2px] text-[10px] font-mono font-bold uppercase transition border ${
              crtEnabled()
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 border-[#d4d6dc] dark:border-[#272b34]'
            }`}
          >
            CRT: {crtEnabled() ? 'ON' : 'OFF'}
          </button>

          {/* Keyboard Shortcuts Palette Trigger */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            title="Keyboard Accelerators (?)"
            class="hidden lg:inline-flex px-2 py-1 rounded-[2px] text-xs font-mono text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-[#ebedf1] dark:hover:bg-[#1c1f26] transition border border-[#d4d6dc] dark:border-[#272b34]"
          >
            <IconKeyboard class="w-3.5 h-3.5" />
          </button>

          {/* Theme Changing Toggle */}
          <button
            onClick={toggleTheme}
            title={theme() === 'dark' ? 'Switch to Light Mode (T)' : 'Switch to Dark Mode (T)'}
            class="p-1.5 sm:px-2.5 sm:py-1 rounded-[2px] text-xs font-mono text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-[#ebedf1] dark:hover:bg-[#1c1f26] transition flex items-center gap-1.5 border border-[#d4d6dc] dark:border-[#272b34]"
          >
            <Show when={theme() === 'dark'} fallback={<IconMoon class="w-3.5 h-3.5" />}>
              <IconSun class="w-3.5 h-3.5 text-amber-400" />
            </Show>
            <span class="text-[10px] uppercase font-bold hidden sm:inline">{theme()}</span>
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
                class="px-3 sm:px-3.5 py-1 rounded-[2px] text-xs font-semibold bg-zinc-900 dark:bg-blue-600 hover:bg-zinc-800 dark:hover:bg-blue-500 text-white transition shadow-[1px_1px_0px_rgba(0,0,0,0.15)] shrink-0"
              >
                Sign In
              </button>
            }
          >
            {(u) => (
              <div class="flex items-center gap-1.5 sm:gap-2">
                <div class="flex items-center gap-1 sm:gap-1.5 text-xs font-medium">
                  <span class="text-zinc-800 dark:text-zinc-200 font-semibold max-w-[90px] sm:max-w-none truncate">{u().name}</span>
                  <span class="px-1.5 py-0.2 rounded-[2px] text-[10px] font-semibold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hidden sm:inline">
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

      {/* Keyboard Shortcuts Accelerator Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen()}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Auth Modal (Login / Register) */}
      <Show when={isAuthOpen()}>
        <div class="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div class="notion-card w-full max-w-sm p-6 shadow-[3px_3px_0px_rgba(0,0,0,0.25)] bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#2b303a]">
            <div class="flex items-center justify-between mb-4 pb-2.5 border-b border-[#eaecf0] dark:border-[#222630]">
              <h2 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {authMode() === 'login' ? 'Sign In to Host & Compete' : 'Create Competitor Account'}
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
                    placeholder="Participant or Organizer Name"
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
                  class="btn-workstation btn-workstation-primary w-full text-xs flex items-center justify-center gap-2"
                >
                  <Show when={authSubmitting()}>
                    <ButtonSpinner class="w-3.5 h-3.5 text-white" />
                  </Show>
                  <span>
                    {authSubmitting()
                      ? (authMode() === 'login' ? 'Authenticating...' : 'Creating Account...')
                      : (authMode() === 'login' ? 'Sign In' : 'Create Account')}
                  </span>
                </button>
              </div>

              <div class="text-center pt-2 border-t border-[#eaecf0] dark:border-[#222630]">
                <Show when={authMode() === 'login'}>
                  <div class="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Sign in to host tournaments, join team squads, and submit solutions.
                  </div>
                </Show>
                <Show when={authMode() === 'register'}>
                  <div class="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Create an account to participate in live coding competitions and form squads.
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
