import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import LandingPage from './LandingPage';
import ContestArena from './ContestArena';
import TeamsPage from './TeamsPage';
import ScoreboardPage from './ScoreboardPage';
import AdminDashboard from './AdminDashboard';
import ShortcutsModal from './ShortcutsModal';
import { SystemHeartbeatPill, ButtonSpinner } from './Loaders';
import { IconX, IconSun, IconMoon, IconKeyboard, IconLock, IconBenchLogo } from './icons';

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
  const [isContestLocked, setIsContestLocked] = createSignal<boolean>(false);
  const [lockWarningToast, setLockWarningToast] = createSignal<string | null>(null);

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

  const isLockedForContest = () => isContestLocked() && user()?.role !== 'admin';

  const navigateToView = (mode: 'home' | 'contest' | 'teams' | 'scoreboard' | 'admin') => {
    if (isLockedForContest() && mode !== 'contest') {
      setLockWarningToast('Competition in progress! Navigation is locked to the Arena until the contest concludes.');
      setTimeout(() => setLockWarningToast(null), 4000);
      return;
    }
    setViewMode(mode);
    try {
      localStorage.setItem('codebench_view', mode);
      const targetHash = '#' + (mode === 'contest' ? 'arena' : mode);
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    } catch {}
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

    if (e.key === '1') navigateToView('home');
    else if (e.key === '2') navigateToView('contest');
    else if (e.key === '3') navigateToView('teams');
    else if (e.key === '4') navigateToView('scoreboard');
    else if (e.key === '5' && user()?.role === 'admin') navigateToView('admin');
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

    // Check contest lock status immediately and on intervals
    const checkContestLock = async () => {
      try {
        const res = await fetch('/api/contests');
        if (res.ok) {
          const list = await res.json();
          if (list && list.length > 0) {
            const c = list[0];
            const st = String(c.state || '').toUpperCase();
            const locked = (st === 'RUNNING' || st === 'FROZEN') && !c.is_paused;
            setIsContestLocked(locked);
            if (locked && user()?.role !== 'admin' && viewMode() !== 'contest') {
              navigateToView('contest');
            }
          }
        }
      } catch {}
    };

    checkContestLock();
    const lockPoller = setInterval(checkContestLock, 3000);

    // Route & Tab persistence on browser refresh
    const hash = window.location.hash.toLowerCase().replace('#', '');
    const path = window.location.pathname.toLowerCase();
    const saved = localStorage.getItem('codebench_view');

    let initialView: 'home' | 'contest' | 'teams' | 'scoreboard' | 'admin' = 'home';
    if (hash === 'arena' || hash === 'contest' || path.startsWith('/arena') || path.startsWith('/contest')) {
      initialView = 'contest';
    } else if (hash === 'squads' || hash === 'teams' || path.startsWith('/teams') || path.startsWith('/squads')) {
      initialView = 'teams';
    } else if (hash === 'scoreboard' || hash === 'standings' || path.startsWith('/scoreboard') || path.startsWith('/standings')) {
      initialView = 'scoreboard';
    } else if (hash === 'admin' || path.startsWith('/admin')) {
      initialView = 'admin';
    } else if (saved && ['home', 'contest', 'teams', 'scoreboard', 'admin'].includes(saved)) {
      initialView = saved as 'home' | 'contest' | 'teams' | 'scoreboard' | 'admin';
    }
    setViewMode(initialView);
    try {
      const targetHash = '#' + (initialView === 'contest' ? 'arena' : initialView);
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    } catch {}

    const handleHashChange = () => {
      const h = window.location.hash.toLowerCase().replace('#', '');
      let target: 'home' | 'contest' | 'teams' | 'scoreboard' | 'admin' = 'home';
      if (h === 'arena' || h === 'contest') target = 'contest';
      else if (h === 'squads' || h === 'teams') target = 'teams';
      else if (h === 'scoreboard' || h === 'standings') target = 'scoreboard';
      else if (h === 'admin') target = 'admin';
      navigateToView(target);
    };
    window.addEventListener('hashchange', handleHashChange);

    onCleanup(() => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('hashchange', handleHashChange);
      clearInterval(lockPoller);
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
    <div class="min-h-screen bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors duration-150">
      {/* Top Header Navigation: Monochromatic Boxed Bar */}
      <header class="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 gap-3">
        <div class="flex items-center gap-3 sm:gap-6 min-w-0">
          <div
            class="flex items-center gap-2 cursor-pointer group shrink-0"
            onClick={() => navigateToView('home')}
            title="CodeBench Home"
          >
            <div class="w-7 h-7 flex items-center justify-center text-neutral-900 dark:text-white transition group-hover:opacity-70">
              <IconBenchLogo class="w-6 h-6" />
            </div>
            <span class="font-bold text-sm tracking-tight text-neutral-900 dark:text-white hidden xs:inline-block">
              CodeBench
            </span>
          </div>

          {/* Clean Boxed Segmented Navigation Tabs */}
          <nav class="flex items-center bg-neutral-100 dark:bg-neutral-950 p-0.5 border border-neutral-200 dark:border-neutral-800 text-xs font-medium overflow-x-auto no-scrollbar shrink">
            <button
              onClick={() => navigateToView('home')}
              title={isLockedForContest() ? 'Locked during active competition' : 'Home'}
              class={`px-3 py-1 transition shrink-0 flex items-center gap-1.5 ${
                isLockedForContest()
                  ? 'opacity-40 cursor-not-allowed text-neutral-400 dark:text-neutral-600'
                  : viewMode() === 'home'
                    ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <Show when={isLockedForContest()}>
                <IconLock class="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
              </Show>
              <span>Home</span>
            </button>
            <button
              onClick={() => navigateToView('contest')}
              class={`px-3 py-1 transition shrink-0 flex items-center gap-1.5 ${
                viewMode() === 'contest'
                  ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <Show when={isLockedForContest()}>
                <span class="relative flex h-1.5 w-1.5 shrink-0">
                  <span class="animate-ping absolute inline-flex h-full w-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              </Show>
              <span>Arena</span>
            </button>
            <button
              onClick={() => navigateToView('teams')}
              title={isLockedForContest() ? 'Locked during active competition' : 'Squads'}
              class={`px-3 py-1 transition shrink-0 flex items-center gap-1.5 ${
                isLockedForContest()
                  ? 'opacity-40 cursor-not-allowed text-neutral-400 dark:text-neutral-600'
                  : viewMode() === 'teams'
                    ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <Show when={isLockedForContest()}>
                <IconLock class="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
              </Show>
              <span>Squads</span>
            </button>
            <button
              onClick={() => navigateToView('scoreboard')}
              title={isLockedForContest() ? 'Locked during active competition' : 'Scoreboard'}
              class={`px-3 py-1 transition shrink-0 flex items-center gap-1.5 ${
                isLockedForContest()
                  ? 'opacity-40 cursor-not-allowed text-neutral-400 dark:text-neutral-600'
                  : viewMode() === 'scoreboard'
                    ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }`}
            >
              <Show when={isLockedForContest()}>
                <IconLock class="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0" />
              </Show>
              <span>Scoreboard</span>
            </button>
            <Show when={user()?.role === 'admin'}>
              <button
                onClick={() => navigateToView('admin')}
                class={`px-3 py-1 transition shrink-0 ${
                  viewMode() === 'admin'
                    ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Admin
              </button>
            </Show>
          </nav>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          {/* Contest Arena Lockdown Status Box */}
          <Show when={isLockedForContest()}>
            <div class="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 text-xs font-medium shrink-0">
              <IconLock class="w-3 h-3 text-neutral-600 dark:text-neutral-400" />
              <span>Arena Locked</span>
            </div>
          </Show>

          {/* Live System Heartbeat & Telemetry Monitor */}
          <div class="hidden sm:inline-flex">
            <SystemHeartbeatPill />
          </div>

          {/* Keyboard Shortcuts Palette Trigger */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            title="Keyboard Shortcuts (?)"
            class="hidden lg:inline-flex p-1.5 text-xs text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition border border-neutral-200 dark:border-neutral-800"
          >
            <IconKeyboard class="w-3.5 h-3.5" />
          </button>

          {/* Theme Changing Toggle */}
          <button
            onClick={toggleTheme}
            title={theme() === 'dark' ? 'Switch to Light Mode (T)' : 'Switch to Dark Mode (T)'}
            class="p-1.5 text-xs text-neutral-600 hover:text-black dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition border border-neutral-200 dark:border-neutral-800"
          >
            <Show when={theme() === 'dark'} fallback={<IconMoon class="w-3.5 h-3.5" />}>
              <IconSun class="w-3.5 h-3.5 text-neutral-100" />
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
                class="px-3.5 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition border border-black dark:border-white shrink-0"
              >
                Sign In
              </button>
            }
          >
            {(u) => (
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1.5 text-xs font-medium">
                  <span class="text-neutral-900 dark:text-white font-semibold max-w-[90px] sm:max-w-none truncate">{u().name}</span>
                  <span class="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700 hidden sm:inline">
                    {u().role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  class="px-2 py-1 text-xs text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800"
                >
                  Log out
                </button>
              </div>
            )}
          </Show>
        </div>
      </header>

      {/* Contest Lockdown Notification Toast */}
      <Show when={lockWarningToast()}>
        <div class="fixed top-14 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] transition-all animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-auto">
          <div class="bg-black text-white dark:bg-white dark:text-black border border-neutral-800 dark:border-neutral-200 shadow-xl rounded-none p-3.5 flex items-start gap-3">
            <div class="w-7 h-7 rounded-none bg-neutral-800 text-neutral-200 dark:bg-neutral-200 dark:text-neutral-900 flex items-center justify-center shrink-0 mt-0.5 border border-neutral-700 dark:border-neutral-300">
              <IconLock class="w-3.5 h-3.5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[11px] font-bold uppercase tracking-wider text-neutral-300 dark:text-neutral-700">
                Arena Lockdown Active
              </div>
              <p class="text-xs text-neutral-200 dark:text-neutral-800 mt-0.5 leading-relaxed">
                {lockWarningToast()}
              </p>
            </div>
            <button
              onClick={() => setLockWarningToast(null)}
              class="p-1 rounded-none text-neutral-400 hover:text-white dark:hover:text-black transition shrink-0 -mr-1 -mt-1"
              title="Dismiss notification"
            >
              <IconX class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </Show>

      {/* Main Body Views */}
      <Show when={viewMode() === 'home'}>
        <LandingPage
          user={user()}
          onNavigate={(target) => navigateToView(target)}
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
          onContestLockChange={(locked) => {
            setIsContestLocked(locked);
            if (locked && user()?.role !== 'admin' && viewMode() !== 'contest') {
              navigateToView('contest');
            }
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
          <div class="w-full max-w-sm p-6 bg-white dark:bg-[#09090b] border border-neutral-300 dark:border-neutral-800 shadow-2xl">
            <div class="flex items-center justify-between mb-4 pb-2.5 border-b border-neutral-200 dark:border-neutral-800">
              <h2 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {authMode() === 'login' ? 'Sign In to Host & Compete' : 'Create Competitor Account'}
              </h2>
              <button
                onClick={() => setIsAuthOpen(false)}
                class="p-1 text-neutral-400 hover:text-black dark:hover:text-white transition"
              >
                <IconX class="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div class="flex border-b border-neutral-200 dark:border-neutral-800 mb-4 text-xs font-medium">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                class={`flex-1 pb-2 border-b-2 transition ${
                  authMode() === 'login'
                    ? 'border-black dark:border-white text-neutral-900 dark:text-neutral-100 font-semibold'
                    : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                class={`flex-1 pb-2 border-b-2 transition ${
                  authMode() === 'register'
                    ? 'border-black dark:border-white text-neutral-900 dark:text-neutral-100 font-semibold'
                    : 'border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} class="space-y-3">
              <Show when={authError()}>
                <div class="bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 p-2.5 text-xs text-rose-600 dark:text-rose-400">
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
