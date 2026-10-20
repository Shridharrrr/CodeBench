import { createSignal, onMount, Show, For } from 'solid-js';
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
  problem_count?: number;
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

  const formatIST = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }) + ' IST';
    } catch {
      return dateStr;
    }
  };

  return (
    <div class="flex-1 bg-[#f4f5f7] dark:bg-[#090a0c] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-100">
      {/* Main Hero */}
      <section class="py-14 md:py-20 px-6 max-w-4xl mx-auto w-full text-center">
        <div class="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold mb-6 bg-white dark:bg-[#14171d] text-zinc-700 dark:text-zinc-300 border border-[#d4d6dc] dark:border-[#272b34] shadow-[1px_1px_0px_rgba(0,0,0,0.06)] rounded-[2px]">
          <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>Competitive Programming Platform</span>
        </div>

        <h1 class="text-3xl md:text-5xl font-bold font-sans tracking-tight text-zinc-900 dark:text-zinc-100 max-w-2xl mx-auto leading-tight">
          Clean, reliable competitive programming.
        </h1>

        <p class="text-sm md:text-base font-sans text-zinc-600 dark:text-zinc-400 mt-4 max-w-xl mx-auto leading-relaxed">
          Real-time algorithmic contests with isolated sandboxes, synchronized round timing, and collaborative squad formation.
        </p>

        {/* Action Buttons */}
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => props.onNavigate('contest')}
            class="btn-workstation btn-workstation-primary px-5 py-2.5 text-xs shadow-[1px_1px_0px_rgba(0,0,0,0.2)]"
          >
            <span>Enter Arena</span>
            <IconArrowRight class="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => props.onNavigate('teams')}
            class="btn-workstation btn-workstation-secondary px-4 py-2.5 text-xs"
          >
            <IconUsers class="w-3.5 h-3.5 text-zinc-500" />
            <span>Squads</span>
          </button>

          <button
            onClick={() => props.onNavigate('scoreboard')}
            class="btn-workstation btn-workstation-secondary px-4 py-2.5 text-xs"
          >
            <IconTrophy class="w-3.5 h-3.5 text-amber-500" />
            <span>Scoreboard</span>
          </button>

          <Show when={props.user?.role === 'admin'}>
            <button
              onClick={() => props.onNavigate('admin')}
              class="btn-workstation btn-workstation-secondary px-4 py-2.5 text-xs border-indigo-400 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400"
            >
              <IconSettings class="w-3.5 h-3.5" />
              <span>Admin Dashboard</span>
            </button>
          </Show>
        </div>
      </section>

      {/* Live Event Status Panel */}
      <section class="px-6 max-w-4xl mx-auto w-full mb-12">
        <div class="notion-card bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#272b34] overflow-hidden rounded-[2px] shadow-[1px_1px_0px_rgba(0,0,0,0.06)] dark:shadow-[1px_1px_0px_rgba(0,0,0,0.4)]">
          {/* Header Bar */}
          <div class="px-5 py-3 bg-[#f0f2f5] dark:bg-[#16181f] border-b border-[#d4d6dc] dark:border-[#272b34] flex items-center justify-between text-xs">
            <span class="font-semibold text-zinc-800 dark:text-zinc-200">
              Contest Status
            </span>

            <button
              onClick={() => props.onNavigate('scoreboard')}
              class="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5 transition font-medium"
            >
              <IconTrophy class="w-3.5 h-3.5 text-amber-500" />
              <span>View Scoreboard</span>
            </button>
          </div>

          <div class="p-6">
            <Show
              when={!loading() && activeContest()}
              fallback={
                <div class="py-8 text-center space-y-3">
                  <div class="w-9 h-9 rounded-[2px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto border border-zinc-300 dark:border-zinc-700">
                    <IconClock class="w-4 h-4" />
                  </div>
                  <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    No contests currently scheduled
                  </h3>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                    Contests unlock immediately once scheduled and started by an administrator. You can organize your squad in the meantime.
                  </p>
                  <Show when={props.user?.role === 'admin'}>
                    <div class="pt-2">
                      <button
                        onClick={() => props.onNavigate('admin')}
                        class="btn-workstation btn-workstation-primary text-xs"
                      >
                        Open Admin Dashboard
                      </button>
                    </div>
                  </Show>
                </div>
              }
            >
              {(c) => (
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div class="space-y-2">
                    <div class="flex items-center gap-2.5">
                      <h2 class="text-base font-bold text-zinc-900 dark:text-white">
                        {c().title}
                      </h2>
                      <span
                        class={`status-chip ${
                          c().state === 'RUNNING'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                            : c().state === 'PAUSED'
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {c().is_paused ? 'Paused' : (c().state === 'RUNNING' ? 'Running' : 'Upcoming')}
                      </span>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Scoring: <strong class="text-zinc-900 dark:text-zinc-200 uppercase">{c().scoring}</strong></span>
                      <span class="text-zinc-300 dark:text-zinc-700">&bull;</span>
                      <span>Format: <strong class="text-zinc-900 dark:text-zinc-200">{c().is_team_contest ? `Squads (max ${c().max_team_size})` : 'Individual'}</strong></span>
                      <span class="text-zinc-300 dark:text-zinc-700">&bull;</span>
                      <span>Start Time: <strong class="text-zinc-900 dark:text-zinc-200">{formatIST(c().starts_at)}</strong></span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => props.onNavigate('contest')}
                      class="btn-workstation btn-workstation-primary px-4 py-2 text-xs"
                    >
                      <span>{c().state === 'RUNNING' ? 'Enter Arena' : 'View Schedule'}</span>
                      <IconArrowRight class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </Show>
          </div>
        </div>
      </section>

      {/* Supported Compilers & Environments */}
      <section class="px-6 max-w-4xl mx-auto w-full mb-14">
        <div class="p-5 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#272b34] rounded-[2px] shadow-[1px_1px_0px_rgba(0,0,0,0.05)]">
          <div class="flex items-center justify-between mb-3 pb-2 border-b border-[#d4d6dc] dark:border-[#272b34]">
            <h3 class="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Supported Languages & Environments
            </h3>
            <span class="text-[11px] text-zinc-500">Isolated Linux Sandboxes</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
            <div class="p-2.5 bg-[#f8f9fa] dark:bg-[#0c0d0e] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px]">
              <span class="font-bold text-zinc-900 dark:text-white block font-mono">C++23</span>
              <span class="text-[10px] text-zinc-500">GCC 14 / Clang 18</span>
            </div>
            <div class="p-2.5 bg-[#f8f9fa] dark:bg-[#0c0d0e] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px]">
              <span class="font-bold text-zinc-900 dark:text-white block font-mono">C23</span>
              <span class="text-[10px] text-zinc-500">GCC 14 / Clang 18</span>
            </div>
            <div class="p-2.5 bg-[#f8f9fa] dark:bg-[#0c0d0e] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px]">
              <span class="font-bold text-zinc-900 dark:text-white block font-mono">Python 3.12</span>
              <span class="text-[10px] text-zinc-500">Standard Library</span>
            </div>
            <div class="p-2.5 bg-[#f8f9fa] dark:bg-[#0c0d0e] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px]">
              <span class="font-bold text-zinc-900 dark:text-white block font-mono">Rust 1.85</span>
              <span class="text-[10px] text-zinc-500">Edition 2024</span>
            </div>
            <div class="p-2.5 bg-[#f8f9fa] dark:bg-[#0c0d0e] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px]">
              <span class="font-bold text-zinc-900 dark:text-white block font-mono">Go 1.24</span>
              <span class="text-[10px] text-zinc-500">Static Binary</span>
            </div>
          </div>
        </div>
      </section>

      {/* Classic Clean Footer */}
      <footer class="mt-auto py-5 border-t border-[#d4d6dc] dark:border-[#262a32] bg-[#eaedf1] dark:bg-[#0e1014] text-xs text-zinc-500">
        <div class="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div class="flex items-center gap-2 font-medium">
            <span class="text-zinc-800 dark:text-zinc-200">CodeBench</span>
            <span>&bull;</span>
            <span>Algorithmic Contests & ICPC Platform</span>
          </div>
          <div>
            Timezone: Asia/Kolkata (IST)
          </div>
        </div>
      </footer>
    </div>
  );
}
