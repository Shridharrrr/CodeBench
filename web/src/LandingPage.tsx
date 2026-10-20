import { createSignal, onMount, Show } from 'solid-js';
import {
  IconUsers,
  IconShield,
  IconClock,
  IconSettings,
  IconArrowRight,
  IconTrophy,
  IconServer,
  IconActivity,
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
  onNavigate: (view: 'home' | 'contest' | 'teams' | 'scoreboard' | 'admin') => void;
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
      return (
        d.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }) + ' IST'
      );
    } catch {
      return dateStr;
    }
  };

  return (
    <div class="flex-1 bg-[#f4f5f7] dark:bg-[#090a0c] text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors duration-100">
      {/* Top Mainframe Telemetry Bar */}
      <div class="border-b border-[#d4d6dc] dark:border-[#222630] bg-[#eaedf1] dark:bg-[#0e1015] px-4 py-2 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <strong class="text-zinc-800 dark:text-zinc-200">CLUSTER: ONLINE</strong>
          </span>
          <span class="text-zinc-300 dark:text-zinc-700">|</span>
          <span>QUEUE: NATS JETSTREAM 2.10</span>
          <span class="text-zinc-300 dark:text-zinc-700">|</span>
          <span>SANDBOX: SECCOMP-BPF STRICT</span>
        </div>
        <div class="flex items-center gap-3">
          <span>HOST JITTER TOL: &lt;15%</span>
          <span class="px-2 py-0.5 rounded-[2px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
            ALL SYSTEMS NOMINAL
          </span>
        </div>
      </div>

      {/* Main Hero Section */}
      <section class="py-14 md:py-20 px-6 max-w-5xl mx-auto w-full text-center">
        {/* Monospace System Badge */}
        <div class="inline-flex items-center gap-2 px-3 py-1 text-xs font-mono mb-6 bg-white dark:bg-[#14171d] text-zinc-700 dark:text-zinc-300 border border-[#d4d6dc] dark:border-[#272b34] shadow-[1px_1px_0px_rgba(0,0,0,0.06)] rounded-[2px]">
          <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span class="font-bold text-zinc-900 dark:text-white">CODEBENCH // BENCHMARK ARENA</span>
          <span class="text-zinc-400 dark:text-zinc-500">&bull;</span>
          <span class="text-[11px] text-zinc-500">LINUX CGROUPS V2 CONTAINMENT</span>
        </div>

        <h1 class="text-3xl md:text-5xl lg:text-6xl font-black font-sans tracking-tight text-zinc-900 dark:text-zinc-100 max-w-4xl mx-auto leading-tight">
          Deterministic Algorithmic Execution at Scale.
        </h1>

        <p class="text-sm md:text-base font-sans text-zinc-600 dark:text-zinc-400 mt-5 max-w-2xl mx-auto leading-relaxed">
          Zero-overhead Linux execution sandboxes, server-authoritative contest clocks, and real-time synchronized squad competition. Engineered for collegiate tournaments and rigorous enterprise evaluations without clock drift or flaky test runs.
        </p>

        {/* Action Buttons */}
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => props.onNavigate('contest')}
            class="btn-workstation btn-workstation-primary px-5 py-2.5 text-xs shadow-[2px_2px_0px_rgba(0,0,0,0.25)] flex items-center gap-2"
          >
            <span>Enter Competition Arena</span>
            <IconArrowRight class="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => props.onNavigate('teams')}
            class="btn-workstation btn-workstation-secondary px-4 py-2.5 text-xs flex items-center gap-2"
          >
            <IconUsers class="w-3.5 h-3.5 text-zinc-500" />
            <span>Manage Squads</span>
          </button>

          <button
            onClick={() => props.onNavigate('scoreboard')}
            class="btn-workstation btn-workstation-secondary px-4 py-2.5 text-xs flex items-center gap-2"
          >
            <IconTrophy class="w-3.5 h-3.5 text-amber-500" />
            <span>Live Scoreboard</span>
          </button>

          <Show when={props.user?.role === 'admin'}>
            <button
              onClick={() => props.onNavigate('admin')}
              class="btn-workstation btn-workstation-secondary px-4 py-2.5 text-xs border-indigo-400 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 flex items-center gap-2"
            >
              <IconSettings class="w-3.5 h-3.5" />
              <span>Admin Dashboard</span>
            </button>
          </Show>
        </div>
      </section>

      {/* Live Contest Event Status Panel */}
      <section class="px-6 max-w-5xl mx-auto w-full mb-14">
        <div class="bg-white dark:bg-[#111317] border border-zinc-200 dark:border-zinc-800 overflow-hidden rounded-lg shadow-xs">
          {/* Header Bar */}
          <div class="px-5 py-3 bg-[#f8f9fa] dark:bg-[#151821] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-mono">
            <span class="font-bold text-zinc-800 dark:text-zinc-200">
              CURRENT CONTEST STATUS
            </span>

            <button
              onClick={() => props.onNavigate('scoreboard')}
              class="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5 transition font-medium text-xs font-sans"
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
                  <div class="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto border border-zinc-200 dark:border-zinc-700">
                    <IconClock class="w-4 h-4" />
                  </div>
                  <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-sans">
                    No active round currently running
                  </h3>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed font-sans">
                    Rounds unlock immediately once configured and scheduled by an administrator. You can organize your squad in the meantime or practice in local mode.
                  </p>
                  <Show when={props.user?.role === 'admin'}>
                    <div class="pt-2">
                      <button
                        onClick={() => props.onNavigate('admin')}
                        class="btn-workstation btn-workstation-primary text-xs"
                      >
                        Launch Contest from Admin
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
                      <h2 class="text-base font-bold text-zinc-900 dark:text-white font-sans">
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
                        {c().is_paused
                          ? 'Paused'
                          : c().state === 'RUNNING'
                          ? 'Running'
                          : 'Upcoming'}
                      </span>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 font-sans">
                      <span>
                        Scoring:{' '}
                        <strong class="text-zinc-900 dark:text-zinc-200 uppercase">
                          {c().scoring === 'icpc' ? 'Standard Penalty' : c().scoring}
                        </strong>
                      </span>
                      <span class="text-zinc-300 dark:text-zinc-700">&bull;</span>
                      <span>
                        Format:{' '}
                        <strong class="text-zinc-900 dark:text-zinc-200">
                          {c().is_team_contest
                            ? `Squads (max ${c().max_team_size})`
                            : 'Individual'}
                        </strong>
                      </span>
                      <span class="text-zinc-300 dark:text-zinc-700">&bull;</span>
                      <span>
                        Start Time:{' '}
                        <strong class="text-zinc-900 dark:text-zinc-200">
                          {formatIST(c().starts_at)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => props.onNavigate('contest')}
                      class="btn-workstation btn-workstation-primary px-4 py-2 text-xs font-sans"
                    >
                      <span>
                        {c().state === 'RUNNING' ? 'Enter Arena' : 'View Schedule'}
                      </span>
                      <IconArrowRight class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </Show>
          </div>
        </div>
      </section>

      {/* Redesigned Architecture & Engineering Foundations Section */}
      <section class="px-6 max-w-5xl mx-auto w-full mb-16">
        {/* Clean Editorial Section Header */}
        <div class="mb-8 text-center max-w-2xl mx-auto">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-xs font-mono font-semibold tracking-wider uppercase text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 mb-3">
            <span>Kernel Foundations & Security</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Deterministic execution, built from the kernel up.
          </h2>
          <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-2.5 leading-relaxed">
            Hardware-level Linux containment and server-authoritative clocks protect every contest from virtualization steal-time and client tampering.
          </p>
        </div>

        {/* 4 Architectural Pillars Grid */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Seccomp-BPF */}
          <div class="bg-white dark:bg-[#111317] border border-zinc-200 dark:border-[#222733] rounded-lg p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/60 flex items-center justify-center">
                  <IconShield class="w-4 h-4" />
                </div>
                <span class="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-[2px] border border-zinc-200 dark:border-zinc-700">
                  SECCOMP-BPF
                </span>
              </div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-sans tracking-tight">
                Kernel Syscall Whitelist & Namespaces
              </h3>
              <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                Every submission spawns in isolated PID, network, and mount namespaces with a read-only rootfs. Outbound sockets, fork bombs, and unwhitelisted syscalls are killed instantly by the kernel filter.
              </p>
            </div>
            <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span class="text-emerald-600 dark:text-emerald-400 font-medium">● Strict Syscall Filter</span>
              <span>CLONE_NEWPID • NET</span>
            </div>
          </div>

          {/* Card 2: NATS JetStream */}
          <div class="bg-white dark:bg-[#111317] border border-zinc-200 dark:border-[#222733] rounded-lg p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-center">
                  <IconServer class="w-4 h-4" />
                </div>
                <span class="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-[2px] border border-zinc-200 dark:border-zinc-700">
                  JETSTREAM 2.10
                </span>
              </div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-sans tracking-tight">
                Zero-Loss Transactional Outbox
              </h3>
              <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                Code submissions are committed to PostgreSQL atomically alongside outbox events before streaming via embedded NATS JetStream with write-ahead persistence and fair-share queueing.
              </p>
            </div>
            <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span class="text-blue-600 dark:text-blue-400 font-medium">● Guaranteed At-Least-Once</span>
              <span>WAL Disk-Backed</span>
            </div>
          </div>

          {/* Card 3: Monotonic Clocks */}
          <div class="bg-white dark:bg-[#111317] border border-zinc-200 dark:border-[#222733] rounded-lg p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/60 flex items-center justify-center">
                  <IconClock class="w-4 h-4" />
                </div>
                <span class="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-[2px] border border-zinc-200 dark:border-zinc-700">
                  MONOTONIC TIME
                </span>
              </div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-sans tracking-tight">
                Server-Authoritative Timing
              </h3>
              <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                Client-side clock tampering is impossible. Round timers, penalty increments, and scoreboard freeze/unfreeze ceremonies run strictly on tamper-proof monotonic server time.
              </p>
            </div>
            <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span class="text-amber-600 dark:text-amber-400 font-medium">● 0ms Clock Drift</span>
              <span>NTP Synchronized</span>
            </div>
          </div>

          {/* Card 4: Canary Benchmark */}
          <div class="bg-white dark:bg-[#111317] border border-zinc-200 dark:border-[#222733] rounded-lg p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="w-8 h-8 rounded-md bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-200/80 dark:border-cyan-900/60 flex items-center justify-center">
                  <IconActivity class="w-4 h-4" />
                </div>
                <span class="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-[2px] border border-zinc-200 dark:border-zinc-700">
                  JITTER CANARY
                </span>
              </div>
              <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 font-sans tracking-tight">
                Continuous Hardware Canaries
              </h3>
              <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                Continuous 60-second micro-benchmarks measure CPU steal-time on judge workers. Dynamic time dilation automatically prevents false Time Limit Exceeded (TLE) verdicts.
              </p>
            </div>
            <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span class="text-cyan-600 dark:text-cyan-400 font-medium">● Steal-Time Calibration</span>
              <span>Dynamic Dilation</span>
            </div>
          </div>
        </div>

        {/* Refined Integrated Telemetry & Benchmark Ribbon */}
        <div class="mt-4 bg-white dark:bg-[#111317] border border-zinc-200 dark:border-[#222733] rounded-lg p-6 shadow-xs">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
            <div class="px-2 pt-2 md:pt-0">
              <div class="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                0ms
              </div>
              <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                Clock Drift
              </div>
              <div class="text-[11px] text-zinc-500 mt-0.5 font-sans">
                Monotonic sync
              </div>
            </div>

            <div class="px-2 pt-4 md:pt-0">
              <div class="text-2xl sm:text-3xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400 font-mono">
                &lt; 18ms
              </div>
              <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                Queue Latency
              </div>
              <div class="text-[11px] text-zinc-500 mt-0.5 font-sans">
                P99 submission dispatch
              </div>
            </div>

            <div class="px-2 pt-4 md:pt-0">
              <div class="text-2xl sm:text-3xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400 font-mono">
                64
              </div>
              <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                Process Limit
              </div>
              <div class="text-[11px] text-zinc-500 mt-0.5 font-sans">
                cgroups v2 pids.max
              </div>
            </div>

            <div class="px-2 pt-4 md:pt-0">
              <div class="text-2xl sm:text-3xl font-extrabold tracking-tight text-cyan-600 dark:text-cyan-400 font-mono">
                100%
              </div>
              <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                Kernel Isolation
              </div>
              <div class="text-[11px] text-zinc-500 mt-0.5 font-sans">
                Seccomp-BPF filters
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Workstation Footer */}
      <footer class="mt-auto py-5 border-t border-[#d4d6dc] dark:border-[#262a32] bg-[#eaedf1] dark:bg-[#0e1014] text-xs text-zinc-500 font-mono">
        <div class="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div class="flex items-center gap-2 font-medium">
            <span class="text-zinc-800 dark:text-zinc-200 font-bold">CodeBench v1.4.2</span>
            <span>&bull;</span>
            <span>Deterministic Algorithmic Benchmark Platform</span>
          </div>
          <div class="flex items-center gap-3">
            <span>Timezone: Asia/Kolkata (IST)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
