import { createSignal, onMount, Show } from 'solid-js';
import {
  IconUsers,
  IconShield,
  IconTerminal,
  IconClock,
  IconSettings,
  IconArrowRight,
  IconTrophy,
} from './icons';

interface Contest {
  id: string;
  title: string;
  mode: string;
  starts_at: string;
  ends_at: string;
  freeze_at?: string;
  scoring: string;
  is_paused?: boolean;
  is_team_contest?: boolean;
  max_team_size?: number;
  state?: string;
}

interface LandingPageProps {
  user: { id: string; name: string; email: string; role: string } | null;
  onNavigate: (view: 'contest' | 'teams' | 'scoreboard' | 'admin') => void;
  onOpenAuth: () => void;
}

export default function LandingPage(props: LandingPageProps) {
  const [contests, setContests] = createSignal<Contest[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const res = await fetch('/api/contests');
      if (res.ok) {
        const data = await res.json();
        setContests(data || []);
      }
    } catch (e) {
      console.error('Failed to load contests', e);
    } finally {
      setLoading(false);
    }
  });

  const activeContest = () => (contests().length > 0 ? contests()[0] : null);

  return (
    <div class="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150">
      {/* Hero Section */}
      <section class="py-16 md:py-20 px-6 max-w-5xl mx-auto w-full text-center">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Sandboxed Competitive Programming Engine</span>
        </div>

        <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight max-w-3xl mx-auto leading-tight">
          High-Performance Competitive Coding Platform
        </h1>

        <p class="text-base text-slate-600 dark:text-slate-400 mt-5 max-w-2xl mx-auto leading-relaxed">
          Isolated Linux namespace sandboxes, collaborative team formation, automated test evaluation, and server-synchronized round timing.
        </p>

        {/* Action CTAs */}
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => props.onNavigate('contest')}
            class="px-6 py-3 rounded-lg text-sm font-bold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white transition shadow-sm flex items-center gap-2"
          >
            <span>Enter Contest Arena</span>
            <IconArrowRight class="w-4 h-4" />
          </button>

          <button
            onClick={() => props.onNavigate('teams')}
            class="px-5 py-3 rounded-lg text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-xs flex items-center gap-2"
          >
            <IconUsers class="w-4 h-4 text-slate-500" />
            <span>Manage Teams</span>
          </button>

          <Show when={props.user?.role === 'admin'}>
            <button
              onClick={() => props.onNavigate('admin')}
              class="px-5 py-3 rounded-lg text-sm font-semibold bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition shadow-xs flex items-center gap-1.5"
            >
              <IconSettings class="w-4 h-4" />
              <span>Admin Control Center</span>
            </button>
          </Show>
        </div>
      </section>

      {/* Live Event Status Card */}
      <section class="px-6 max-w-4xl mx-auto w-full mb-14">
        <div class="notion-card p-6 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">Competition Status</span>
              <Show when={activeContest()}>
                {(c) => (
                  <span
                    class={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                      c().state === 'RUNNING'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : c().state === 'PAUSED'
                        ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        : 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {c().is_paused ? 'Paused' : c().state || 'Upcoming'}
                  </span>
                )}
              </Show>
            </div>

            <button
              onClick={() => props.onNavigate('scoreboard')}
              class="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5"
            >
              <IconTrophy class="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
              <span>View Standings</span>
            </button>
          </div>

          <Show
            when={!loading() && activeContest()}
            fallback={
              <div class="py-8 text-center space-y-2">
                <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-300 flex items-center justify-center mx-auto mb-2 border border-slate-200 dark:border-slate-700">
                  <IconClock class="w-5 h-5" />
                </div>
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">No Competition Currently Running</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  The round will begin once configured and launched by the event administrator. You can organize your team in the Teams section to prepare.
                </p>
                <Show when={props.user?.role === 'admin'}>
                  <div class="pt-3">
                    <button
                      onClick={() => props.onNavigate('admin')}
                      class="px-4 py-2 rounded-md text-xs font-bold bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition shadow-xs"
                    >
                      Configure Competition in Admin
                    </button>
                  </div>
                </Show>
              </div>
            }
          >
            {(c) => (
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 class="text-lg font-bold text-slate-900 dark:text-white">{c().title}</h2>
                  <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span>Scoring: <strong class="text-slate-800 dark:text-slate-200 uppercase">{c().scoring}</strong></span>
                    <span class="text-slate-300 dark:text-slate-700">·</span>
                    <span>Format: <strong class="text-slate-800 dark:text-slate-200">{c().is_team_contest ? `Teams (Max ${c().max_team_size})` : 'Individual'}</strong></span>
                    <span class="text-slate-300 dark:text-slate-700">·</span>
                    <span>Starts: <strong class="text-slate-800 dark:text-slate-200">{new Date(c().starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    onClick={() => props.onNavigate('contest')}
                    class="px-4 py-2 rounded-md text-xs font-bold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs flex items-center gap-1.5"
                  >
                    <span>{c().state === 'RUNNING' ? 'Enter Arena' : 'View Schedule'}</span>
                    <IconArrowRight class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </Show>
        </div>
      </section>

      {/* Core Architectural Capabilities */}
      <section class="px-6 max-w-5xl mx-auto w-full mb-16">
        <div class="text-center mb-10">
          <h2 class="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Core Architectural Capabilities</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Built for deterministic code execution, isolation, and reliable evaluation.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="notion-card p-5 space-y-2 dark:bg-slate-900 dark:border-slate-800">
            <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-blue-400 flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <IconUsers class="w-4 h-4" />
            </div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Team Collaboration</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Captains generate secure 6-character team codes. Teammates register together before questions unlock.
            </p>
          </div>

          <div class="notion-card p-5 space-y-2 dark:bg-slate-900 dark:border-slate-800">
            <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-blue-400 flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <IconShield class="w-4 h-4" />
            </div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Kernel Sandbox</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Every submission runs inside isolated Linux namespaces with cgroups v2 quotas and hardware instruction counters.
            </p>
          </div>

          <div class="notion-card p-5 space-y-2 dark:bg-slate-900 dark:border-slate-800">
            <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-blue-400 flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <IconTerminal class="w-4 h-4" />
            </div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Two-Tier Test Runner</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Run test code against visible samples with colored diffs, and verify against hidden suites on submission.
            </p>
          </div>

          <div class="notion-card p-5 space-y-2 dark:bg-slate-900 dark:border-slate-800">
            <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-blue-400 flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <IconClock class="w-4 h-4" />
            </div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Synchronized Timing</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Server-coordinated round starts, pause overrides, automated scoreboard freeze, and audited score adjustments.
            </p>
          </div>
        </div>
      </section>

      {/* Supported Execution Environments */}
      <section class="px-6 max-w-4xl mx-auto w-full mb-14">
        <div class="notion-card p-6 bg-slate-100/50 dark:bg-slate-900/60 dark:border-slate-800">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 text-center">
            Supported Execution Environments
          </h3>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div class="p-3 bg-white dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800">
              <span class="font-bold text-xs text-slate-900 dark:text-white block">C++23</span>
              <span class="text-[10px] text-slate-500 dark:text-slate-400">GCC 14 / Clang 18</span>
            </div>
            <div class="p-3 bg-white dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800">
              <span class="font-bold text-xs text-slate-900 dark:text-white block">C23</span>
              <span class="text-[10px] text-slate-500 dark:text-slate-400">GCC 14 / Clang 18</span>
            </div>
            <div class="p-3 bg-white dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800">
              <span class="font-bold text-xs text-slate-900 dark:text-white block">Python 3.12</span>
              <span class="text-[10px] text-slate-500 dark:text-slate-400">Standard Library</span>
            </div>
            <div class="p-3 bg-white dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800">
              <span class="font-bold text-xs text-slate-900 dark:text-white block">Rust 1.85</span>
              <span class="text-[10px] text-slate-500 dark:text-slate-400">Edition 2024</span>
            </div>
            <div class="p-3 bg-white dark:bg-slate-950 rounded-md border border-slate-200 dark:border-slate-800">
              <span class="font-bold text-xs text-slate-900 dark:text-white block">Go 1.24</span>
              <span class="text-[10px] text-slate-500 dark:text-slate-400">64-bit Linux</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer class="mt-auto py-8 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-400 dark:text-slate-500">
        <div class="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-800 dark:text-slate-200">Codebench</span>
            <span class="text-slate-300 dark:text-slate-600">·</span>
            <span>Real-time ICPC & CTF Evaluation Engine</span>
          </div>
          <div class="text-slate-500 dark:text-slate-400">
            Isolated Linux Kernel Sandbox &bull; Hardware Instruction Counting
          </div>
        </div>
      </footer>
    </div>
  );
}
