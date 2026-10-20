import { createSignal, onMount, Show } from 'solid-js';
import {
  IconUsers,
  IconShield,
  IconClock,
  IconSettings,
  IconArrowRight,
  IconTrophy,
  IconCode,
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
      {/* Top Telemetry & Status Bar */}
      <div class="border-b border-zinc-200 dark:border-zinc-800 bg-[#ebedf2] dark:bg-[#0c0e12] px-4 py-2 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
          <span class="flex items-center gap-1.5 text-zinc-900 dark:text-zinc-200 font-semibold">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Contest Hosting Engine Online
          </span>
          <span class="text-zinc-300 dark:text-zinc-700 hidden sm:inline">&bull;</span>
          <span>Real-Time Submission Queue</span>
          <span class="text-zinc-300 dark:text-zinc-700 hidden sm:inline">&bull;</span>
          <span>Automated Multi-Language Judging</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-zinc-500">Host Status:</span>
          <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-bold text-[10px]">
            OPERATIONAL
          </span>
        </div>
      </div>

      {/* Main Hero Section */}
      <section class="py-12 sm:py-16 md:py-20 px-4 sm:px-6 max-w-5xl mx-auto w-full text-center">
        {/* Monospace System Badge */}
        <div class="inline-flex items-center gap-2 px-3 py-1 text-xs font-mono mb-6 bg-white dark:bg-[#14171d] text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 shadow-2xs rounded">
          <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span class="font-bold text-zinc-900 dark:text-white">Coding Competition Hosting Platform</span>
          <span class="text-zinc-300 dark:text-zinc-600">&bull;</span>
          <span class="text-[11px] text-zinc-500">Automated Judging & Live Leaderboards</span>
        </div>

        <h1 class="text-3xl sm:text-5xl lg:text-6xl font-black font-sans tracking-tight text-zinc-900 dark:text-white max-w-4xl mx-auto leading-[1.12]">
          The Modern Platform to Host Live Coding Competitions.
        </h1>

        <p class="text-sm sm:text-base font-sans text-zinc-600 dark:text-zinc-400 mt-4 sm:mt-5 max-w-2xl mx-auto leading-relaxed">
          Host collegiate tournaments, student hackathons, and technical hiring contests with ease. Featuring automated multi-language execution sandboxes, real-time frozen leaderboards, team squad rosters, and custom problem authoring.
        </p>

        {/* Action Buttons (Fully Responsive on Mobile/Tablet/Desktop) */}
        <div class="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          <button
            onClick={() => props.onNavigate('contest')}
            class="btn-workstation btn-workstation-primary px-5 py-2.5 text-xs shadow-xs flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <span>Enter Contest Arena</span>
            <IconArrowRight class="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => props.onNavigate('teams')}
            class="btn-workstation btn-workstation-secondary px-4 py-2.5 text-xs flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <IconUsers class="w-3.5 h-3.5 text-zinc-500" />
            <span>Manage Squads</span>
          </button>

          <button
            onClick={() => props.onNavigate('scoreboard')}
            class="btn-workstation btn-workstation-secondary px-4 py-2.5 text-xs flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <IconTrophy class="w-3.5 h-3.5 text-amber-500" />
            <span>Live Scoreboard</span>
          </button>

          <Show when={props.user?.role === 'admin'}>
            <button
              onClick={() => props.onNavigate('admin')}
              class="btn-workstation btn-workstation-secondary px-4 py-2.5 text-xs border-indigo-400 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <IconSettings class="w-3.5 h-3.5" />
              <span>Host a Contest (Admin)</span>
            </button>
          </Show>
        </div>
      </section>

      {/* Live Contest Event Status Panel */}
      <section class="px-4 sm:px-6 max-w-5xl mx-auto w-full mb-14">
        <div class="bg-white dark:bg-[#111317] border border-zinc-200 dark:border-zinc-800 overflow-hidden rounded-lg shadow-xs">
          {/* Header Bar */}
          <div class="px-4 sm:px-5 py-3 bg-[#f8f9fa] dark:bg-[#151821] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs font-mono">
            <span class="font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">
              UPCOMING & LIVE COMPETITIONS
            </span>

            <button
              onClick={() => props.onNavigate('scoreboard')}
              class="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1.5 transition font-medium text-xs font-sans"
            >
              <IconTrophy class="w-3.5 h-3.5 text-amber-500" />
              <span>View Leaderboard</span>
            </button>
          </div>

          <div class="p-5 sm:p-6">
            <Show
              when={!loading() && activeContest()}
              fallback={
                <div class="py-8 text-center space-y-3 px-4">
                  <div class="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto border border-zinc-200 dark:border-zinc-700">
                    <IconClock class="w-4 h-4" />
                  </div>
                  <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-sans">
                    No scheduled competition currently active
                  </h3>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed font-sans">
                    Tournament rounds unlock automatically when started by an organizer. Form your squad in the squads tab, test sample problems in the arena, or configure a new round from the admin panel.
                  </p>
                  <Show when={props.user?.role === 'admin'}>
                    <div class="pt-2">
                      <button
                        onClick={() => props.onNavigate('admin')}
                        class="btn-workstation btn-workstation-primary text-xs"
                      >
                        Host Competition from Admin
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
                        Scoring Formula:{' '}
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
                        Scheduled Start:{' '}
                        <strong class="text-zinc-900 dark:text-zinc-200">
                          {formatIST(c().starts_at)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => props.onNavigate('contest')}
                      class="btn-workstation btn-workstation-primary px-4 py-2 text-xs font-sans w-full md:w-auto justify-center"
                    >
                      <span>
                        {c().state === 'RUNNING' ? 'Enter Contest Arena' : 'View Schedule'}
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

      {/* Platform Features & Capabilities Section */}
      <section class="px-4 sm:px-6 max-w-5xl mx-auto w-full mb-16">
        {/* Editorial Section Header */}
        <div class="mb-8 text-center max-w-2xl mx-auto">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-semibold tracking-wider uppercase text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 mb-3">
            <span>Platform Capabilities</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Everything you need to host world-class coding competitions.
          </h2>
          <p class="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-2.5 leading-relaxed">
            Built for university organizers, hackathon leads, and competitive programmers. Experience zero-friction contest hosting with rock-solid judging infrastructure.
          </p>
        </div>

        {/* 4 Architectural Pillars Grid */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Automated Judging */}
          <div class="bg-white dark:bg-[#111317] border border-zinc-200 dark:border-[#222733] rounded-lg p-5 sm:p-6 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="w-8 h-8 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-900/60 flex items-center justify-center">
                  <IconShield class="w-4 h-4" />
                </div>
                <span class="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                  AUTOMATED JUDGE
                </span>
              </div>
              <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 font-sans tracking-tight">
                Automated Multi-Language Judging Sandboxes
              </h3>
              <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                Submissions are evaluated automatically against sample and hidden test suites. Sandboxed in secure Linux namespaces with strict CPU time and memory quotas across C++23, C23, Python 3.12, Rust 1.85, and Go 1.24.
              </p>
            </div>
            <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span class="text-emerald-600 dark:text-emerald-400 font-medium">● Instant Verdicts</span>
              <span>AC • WA • TLE • MLE • CE</span>
            </div>
          </div>

          {/* Card 2: Live Leaderboards */}
          <div class="bg-white dark:bg-[#111317] border border-zinc-200 dark:border-[#222733] rounded-lg p-5 sm:p-6 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="w-8 h-8 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-900/60 flex items-center justify-center">
                  <IconTrophy class="w-4 h-4" />
                </div>
                <span class="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                  LIVE STANDINGS
                </span>
              </div>
              <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 font-sans tracking-tight">
                Real-Time Leaderboards & Scoreboard Freezes
              </h3>
              <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                Tournament leaderboards update instantaneously on every solved problem. Supports standard penalty scoring formulas, points-based rules, and dramatic final-hour scoreboard freezes.
              </p>
            </div>
            <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span class="text-amber-600 dark:text-amber-400 font-medium">● Real-Time Event Stream</span>
              <span>Dynamic Standings & Freezes</span>
            </div>
          </div>

          {/* Card 3: Team Squads */}
          <div class="bg-white dark:bg-[#111317] border border-zinc-200 dark:border-[#222733] rounded-lg p-5 sm:p-6 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="w-8 h-8 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-center">
                  <IconUsers class="w-4 h-4" />
                </div>
                <span class="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                  TEAM SQUADS
                </span>
              </div>
              <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 font-sans tracking-tight">
                Squad Rosters & Team Competition
              </h3>
              <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                Host solo challenges or collaborative team hackathons. Squad captains generate private 6-character invite codes for teammates to synchronize problem-solving and track unified squad scores.
              </p>
            </div>
            <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span class="text-blue-600 dark:text-blue-400 font-medium">● Team Collaboration</span>
              <span>1 to 5 Members per Squad</span>
            </div>
          </div>

          {/* Card 4: Problem Studio */}
          <div class="bg-white dark:bg-[#111317] border border-zinc-200 dark:border-[#222733] rounded-lg p-5 sm:p-6 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="w-8 h-8 rounded-md bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-200/80 dark:border-cyan-900/60 flex items-center justify-center">
                  <IconCode class="w-4 h-4" />
                </div>
                <span class="text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">
                  PROBLEM STUDIO
                </span>
              </div>
              <h3 class="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 font-sans tracking-tight">
                Problem Studio & Testcase Authoring
              </h3>
              <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
                Author custom algorithmic challenges with rich Markdown formatting, specify visible sample tests, upload hidden evaluation test suites, and enforce custom CPU and memory constraints.
              </p>
            </div>
            <div class="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span class="text-cyan-600 dark:text-cyan-400 font-medium">● Markdown & Test Suites</span>
              <span>Custom CPU & Memory Budgets</span>
            </div>
          </div>
        </div>

        {/* Responsive Telemetry & Benchmark Ribbon */}
        <div class="mt-4 bg-white dark:bg-[#111317] border border-zinc-200 dark:border-[#222733] rounded-lg p-5 sm:p-6 shadow-xs">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-center divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800">
            <div class="px-2 py-2 sm:py-0">
              <div class="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                5+
              </div>
              <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                Supported Languages
              </div>
              <div class="text-[11px] text-zinc-500 mt-0.5 font-sans">
                C++, Python, Rust, Go, C
              </div>
            </div>

            <div class="px-2 py-2 sm:py-0">
              <div class="text-2xl sm:text-3xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400 font-mono">
                &lt; 18ms
              </div>
              <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                Judge Latency
              </div>
              <div class="text-[11px] text-zinc-500 mt-0.5 font-sans">
                Real-time queue dispatch
              </div>
            </div>

            <div class="px-2 py-2 sm:py-0">
              <div class="text-2xl sm:text-3xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400 font-mono">
                100%
              </div>
              <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                Sandbox Isolation
              </div>
              <div class="text-[11px] text-zinc-500 mt-0.5 font-sans">
                Process & memory quotas
              </div>
            </div>

            <div class="px-2 py-2 sm:py-0">
              <div class="text-2xl sm:text-3xl font-extrabold tracking-tight text-cyan-600 dark:text-cyan-400 font-mono">
                0ms
              </div>
              <div class="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                Clock Drift
              </div>
              <div class="text-[11px] text-zinc-500 mt-0.5 font-sans">
                Server-authoritative timers
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Clean Workstation Footer */}
      <footer class="mt-auto py-5 border-t border-[#d4d6dc] dark:border-[#262a32] bg-[#eaedf1] dark:bg-[#0e1014] text-xs text-zinc-500 font-mono">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div class="flex items-center gap-2 font-medium">
            <span class="text-zinc-800 dark:text-zinc-200 font-bold">CodeBench v1.4.2</span>
            <span>&bull;</span>
            <span>Modern Coding Competition Hosting Platform</span>
          </div>
          <div class="flex items-center gap-3">
            <span>Timezone: Asia/Kolkata (IST)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
