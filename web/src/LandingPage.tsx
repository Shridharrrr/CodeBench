import { createSignal, onMount, Show, For } from 'solid-js';
import {
  IconUsers,
  IconShield,
  IconClock,
  IconSettings,
  IconArrowRight,
  IconTrophy,
  IconCode,
  IconCheck,
  IconPlay,
  IconTerminal,
  IconServer,
  IconRefresh,
  IconBenchLogo,
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
  const [activeTab, setActiveTab] = createSignal<'submissions' | 'scoreboard' | 'sandboxing' | 'lan'>('submissions');
  const [demoLang, setDemoLang] = createSignal<'python' | 'cpp' | 'go'>('python');
  const [isSimulating, setIsSimulating] = createSignal(false);
  const [simRunDone, setSimRunDone] = createSignal(false);

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

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimRunDone(false);
    setTimeout(() => {
      setIsSimulating(false);
      setSimRunDone(true);
    }, 550);
  };

  const demoCodes = {
    python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, val in enumerate(nums):
            diff = target - val
            if diff in seen:
                return [seen[diff], i]
            seen[val] = i
        return []`,
    cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); ++i) {
            int complement = target - nums[i];
            if (seen.count(complement)) {
                return {seen[complement], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};`,
    go: `func twoSum(nums []int, target int) []int {
    seen := make(map[int]int)
    for i, val := range nums {
        complement := target - val
        if idx, ok := seen[complement]; ok {
            return []int{idx, i}
        }
        seen[val] = i
    }
    return nil
}`,
  };

  return (
    <div class="flex-1 bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors duration-150">
      {/* Hero Section: High-End Editorial Black & White Aesthetics */}
      <section class="pt-16 pb-12 sm:pt-24 sm:pb-16 px-4 sm:px-6 max-w-5xl mx-auto w-full text-center">
        {/* Boxed Badge with clean border */}
        <div class="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 mb-8">
          <span class="w-1.5 h-1.5 bg-black dark:bg-white shrink-0" />
          <span>Self-Hosted & Offline Coding Competitions</span>
        </div>

        {/* Master Headline: Bold Geometric Sans with Editorial Italic Serif Touch */}
        <h1 class="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-neutral-950 dark:text-white max-w-4xl mx-auto leading-[1.08]">
          The platform to host <span class="font-serif-italic font-normal tracking-normal text-black dark:text-white">competitive programming</span> competitions.
        </h1>

        {/* Subtitle */}
        <p class="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">
          Built for universities, coding clubs, and hackathon organizers. Create custom problem sets, evaluate multi-language submissions inside secure Linux sandboxes, and stream live ICPC scoreboards, completely offline or deployed in the cloud.
        </p>

        {/* Primary Action Buttons: Boxed High-Contrast */}
        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => props.onNavigate('contest')}
            class="px-6 py-2.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black border border-black dark:border-white hover:bg-neutral-800 dark:hover:bg-neutral-200 transition flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <span>Enter Contest Arena</span>
            <IconArrowRight class="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => props.onNavigate('scoreboard')}
            class="px-5 py-2.5 text-xs font-medium bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <IconTrophy class="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
            <span>Live Scoreboard</span>
          </button>

          <button
            onClick={() => props.onNavigate('teams')}
            class="px-5 py-2.5 text-xs font-medium bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <IconUsers class="w-3.5 h-3.5 text-neutral-700 dark:text-neutral-300" />
            <span>Squad Rosters</span>
          </button>

          <Show when={props.user?.role === 'admin'}>
            <button
              onClick={() => props.onNavigate('admin')}
              class="px-5 py-2.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white border border-neutral-400 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <IconSettings class="w-3.5 h-3.5" />
              <span>Organizer Panel</span>
            </button>
          </Show>
        </div>
      </section>

      {/* Centerpiece Interactive Component: High-Fidelity Boxed Workbench */}
      <section class="px-4 sm:px-6 max-w-5xl mx-auto w-full mb-16">
        <div class="border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#09090b] shadow-2xl overflow-hidden">
          {/* Top Window Bar: Boxed Tab Switcher */}
          <div class="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex flex-wrap items-center justify-between text-xs">
            <div class="flex items-center overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('submissions')}
                class={`px-4 py-3 font-medium transition border-r border-neutral-200 dark:border-neutral-800 flex items-center gap-2 shrink-0 ${
                  activeTab() === 'submissions'
                    ? 'bg-white dark:bg-[#09090b] text-neutral-950 dark:text-white font-semibold border-b-2 border-b-black dark:border-b-white'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                }`}
              >
                <span>01 Function Execution</span>
              </button>
              <button
                onClick={() => setActiveTab('scoreboard')}
                class={`px-4 py-3 font-medium transition border-r border-neutral-200 dark:border-neutral-800 flex items-center gap-2 shrink-0 ${
                  activeTab() === 'scoreboard'
                    ? 'bg-white dark:bg-[#09090b] text-neutral-950 dark:text-white font-semibold border-b-2 border-b-black dark:border-b-white'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                }`}
              >
                <span>02 Live Standings</span>
              </button>
              <button
                onClick={() => setActiveTab('sandboxing')}
                class={`px-4 py-3 font-medium transition border-r border-neutral-200 dark:border-neutral-800 flex items-center gap-2 shrink-0 ${
                  activeTab() === 'sandboxing'
                    ? 'bg-white dark:bg-[#09090b] text-neutral-950 dark:text-white font-semibold border-b-2 border-b-black dark:border-b-white'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                }`}
              >
                <span>03 Kernel Sandbox</span>
              </button>
              <button
                onClick={() => setActiveTab('lan')}
                class={`px-4 py-3 font-medium transition border-r border-neutral-200 dark:border-neutral-800 flex items-center gap-2 shrink-0 ${
                  activeTab() === 'lan'
                    ? 'bg-white dark:bg-[#09090b] text-neutral-950 dark:text-white font-semibold border-b-2 border-b-black dark:border-b-white'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                }`}
              >
                <span>04 Zero-WAN Network</span>
              </button>
            </div>

            <div class="px-4 py-2 text-[11px] text-neutral-500 hidden sm:flex items-center gap-2 shrink-0">
              <span class="w-2 h-2 bg-emerald-500 inline-block" />
              <span>Interactive Telemetry</span>
            </div>
          </div>

          {/* Interactive Tab 1: Function Execution Sandbox */}
          <Show when={activeTab() === 'submissions'}>
            <div>
              {/* Secondary Toolbar */}
              <div class="px-5 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#09090b] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div class="flex items-center gap-2.5">
                  <span class="font-semibold text-neutral-900 dark:text-white">Problem 01 : Two Sum</span>
                  <span class="px-2 py-0.5 text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700">
                    EASY
                  </span>
                </div>

                <div class="flex items-center gap-2">
                  <div class="flex items-center border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 p-0.5">
                    <button
                      onClick={() => setDemoLang('python')}
                      class={`px-2.5 py-1 text-[11px] font-medium transition ${
                        demoLang() === 'python'
                          ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      Python
                    </button>
                    <button
                      onClick={() => setDemoLang('cpp')}
                      class={`px-2.5 py-1 text-[11px] font-medium transition ${
                        demoLang() === 'cpp'
                          ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      C++
                    </button>
                    <button
                      onClick={() => setDemoLang('go')}
                      class={`px-2.5 py-1 text-[11px] font-medium transition ${
                        demoLang() === 'go'
                          ? 'bg-black text-white dark:bg-white dark:text-black font-semibold'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                      }`}
                    >
                      Go
                    </button>
                  </div>

                  <button
                    onClick={handleRunSimulation}
                    disabled={isSimulating()}
                    class="px-3 py-1.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition border border-black dark:border-white flex items-center gap-1.5"
                  >
                    <Show when={isSimulating()} fallback={<IconPlay class="w-3 h-3" />}>
                      <IconRefresh class="w-3 h-3 animate-spin" />
                    </Show>
                    <span>{isSimulating() ? 'Evaluating...' : 'Run Simulation'}</span>
                  </button>
                </div>
              </div>

              {/* Code & Runner Split View */}
              <div class="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-800">
                <div class="md:col-span-8 p-4 bg-neutral-50/60 dark:bg-[#000000]">
                  <pre class="p-3 bg-white dark:bg-[#09090b] border border-neutral-200 dark:border-neutral-800 font-mono text-xs text-neutral-900 dark:text-neutral-100 leading-relaxed overflow-x-auto">
                    <code>{demoCodes[demoLang()]}</code>
                  </pre>
                </div>

                <div class="md:col-span-4 p-4 space-y-3 bg-white dark:bg-[#09090b]">
                  <div class="text-xs font-semibold text-neutral-900 dark:text-white uppercase tracking-wider">
                    Automated Test Driver
                  </div>

                  <div class="space-y-2 text-xs">
                    <div class="p-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                      <div class="flex items-center justify-between">
                        <span class="font-medium text-neutral-900 dark:text-white">Sample Vector 1</span>
                        <Show when={simRunDone()} fallback={<span class="text-neutral-400 text-[11px]">Ready</span>}>
                          <span class="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                            <IconCheck class="w-3 h-3" />
                            <span>Passed (1ms)</span>
                          </span>
                        </Show>
                      </div>
                      <div class="text-[11px] text-neutral-500 font-sans">
                        nums = [2, 7, 11, 15], target = 9
                      </div>
                    </div>

                    <div class="p-2.5 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-1">
                      <div class="flex items-center justify-between">
                        <span class="font-medium text-neutral-900 dark:text-white">Sample Vector 2</span>
                        <Show when={simRunDone()} fallback={<span class="text-neutral-400 text-[11px]">Ready</span>}>
                          <span class="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                            <IconCheck class="w-3 h-3" />
                            <span>Passed (1ms)</span>
                          </span>
                        </Show>
                      </div>
                      <div class="text-[11px] text-neutral-500 font-sans">
                        nums = [3, 2, 4], target = 6
                      </div>
                    </div>
                  </div>

                  <div class="p-2.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    Function submissions automatically link against our sandboxed C++ / Python / Go driver harness. Competitors solve the problem without boilerplates.
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* Interactive Tab 2: Live ICPC Scoreboard */}
          <Show when={activeTab() === 'scoreboard'}>
            <div>
              <div class="px-5 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-between text-xs">
                <span class="font-semibold text-neutral-900 dark:text-white">Standard ICPC Standings Simulation</span>
                <span class="px-2 py-0.5 text-xs font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700">
                  FREEZE ACTIVE : FINAL 60 MIN
                </span>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse font-sans">
                  <thead class="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium text-[11px] uppercase tracking-wider">
                    <tr>
                      <th class="py-2.5 px-4 w-16 text-center border-r border-neutral-200 dark:border-neutral-800">Rank</th>
                      <th class="py-2.5 px-4 min-w-[180px] border-r border-neutral-200 dark:border-neutral-800">Squad Name</th>
                      <th class="py-2.5 px-4 w-24 text-center border-r border-neutral-200 dark:border-neutral-800">Solved</th>
                      <th class="py-2.5 px-4 w-28 text-center border-r border-neutral-200 dark:border-neutral-800">Penalty</th>
                      <th class="py-2.5 px-3 text-center border-r border-neutral-200 dark:border-neutral-800">A</th>
                      <th class="py-2.5 px-3 text-center border-r border-neutral-200 dark:border-neutral-800">B</th>
                      <th class="py-2.5 px-3 text-center">C</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-200 dark:divide-neutral-800">
                    <tr class="hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
                      <td class="py-3 px-4 text-center border-r border-neutral-200 dark:border-neutral-800 font-bold">1</td>
                      <td class="py-3 px-4 font-semibold text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800">BinaryBandits</td>
                      <td class="py-3 px-4 text-center font-bold text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800">3</td>
                      <td class="py-3 px-4 text-center font-medium text-neutral-600 dark:text-neutral-400 border-r border-neutral-200 dark:border-neutral-800 tabular-nums">48m</td>
                      <td class="py-2.5 px-3 text-center border-r border-neutral-200 dark:border-neutral-800">
                        <span class="py-0.5 px-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-semibold text-xs">+1 8m</span>
                      </td>
                      <td class="py-2.5 px-3 text-center border-r border-neutral-200 dark:border-neutral-800">
                        <span class="py-0.5 px-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-semibold text-xs">+2 18m</span>
                      </td>
                      <td class="py-2.5 px-3 text-center">
                        <span class="py-0.5 px-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-semibold text-xs">+1 22m</span>
                      </td>
                    </tr>
                    <tr class="hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
                      <td class="py-3 px-4 text-center border-r border-neutral-200 dark:border-neutral-800 font-bold">2</td>
                      <td class="py-3 px-4 font-semibold text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800">KernelCrafters</td>
                      <td class="py-3 px-4 text-center font-bold text-neutral-900 dark:text-white border-r border-neutral-200 dark:border-neutral-800">2</td>
                      <td class="py-3 px-4 text-center font-medium text-neutral-600 dark:text-neutral-400 border-r border-neutral-200 dark:border-neutral-800 tabular-nums">35m</td>
                      <td class="py-2.5 px-3 text-center border-r border-neutral-200 dark:border-neutral-800">
                        <span class="py-0.5 px-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-semibold text-xs">+1 14m</span>
                      </td>
                      <td class="py-2.5 px-3 text-center border-r border-neutral-200 dark:border-neutral-800">
                        <span class="py-0.5 px-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-semibold text-xs">+1 21m</span>
                      </td>
                      <td class="py-2.5 px-3 text-center">
                        <span class="py-0.5 px-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 font-semibold text-xs text-rose-600 dark:text-rose-400">-2</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Show>

          {/* Interactive Tab 3: Kernel Sandboxing */}
          <Show when={activeTab() === 'sandboxing'}>
            <div class="p-6 space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Linux Namespace & cgroups v2 Jail</h3>
                  <p class="text-xs text-neutral-500">Kernel-enforced isolation for untrusted competitor submissions</p>
                </div>
                <span class="px-2.5 py-0.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700">
                  Seccomp-BPF Active
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div class="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                  <span class="text-neutral-500 font-medium">Memory Quota</span>
                  <div class="text-base font-bold text-neutral-900 dark:text-white mt-1">256MB Hard Max</div>
                  <p class="text-[11px] text-neutral-500 mt-1">cgroup memory.max terminates runaway allocations</p>
                </div>

                <div class="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                  <span class="text-neutral-500 font-medium">CPU Execution Budget</span>
                  <div class="text-base font-bold text-neutral-900 dark:text-white mt-1">2,000ms Wall Clock</div>
                  <p class="text-[11px] text-neutral-500 mt-1">Deterministic SIGKILL prevents host starvation</p>
                </div>

                <div class="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                  <span class="text-neutral-500 font-medium">Syscall Whitelist</span>
                  <div class="text-base font-bold text-neutral-900 dark:text-white mt-1">Strict Filter</div>
                  <p class="text-[11px] text-neutral-500 mt-1">Blocks raw socket creation, ptrace, and host rootfs</p>
                </div>
              </div>
            </div>
          </Show>

          {/* Interactive Tab 4: LAN Bound */}
          <Show when={activeTab() === 'lan'}>
            <div class="p-6 space-y-4">
              <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Zero External Internet Dependency</h3>
                  <p class="text-xs text-neutral-500">Run collegiate tournaments inside air-gapped auditoriums or lecture halls</p>
                </div>
                <span class="px-2.5 py-0.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700">
                  Local LAN Subnet
                </span>
              </div>

              <div class="p-4 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div class="space-y-1 text-center sm:text-left">
                  <div class="font-bold text-neutral-900 dark:text-white">Single-Laptop Bare-Metal Host</div>
                  <p class="text-neutral-500 leading-relaxed">
                    Start CodeBench on the host machine. Participants connect over standard Wi-Fi router or switch, navigate to the local IP, and immediately code and submit without WAN access.
                  </p>
                </div>
                <div class="px-4 py-2 bg-black dark:bg-white text-white dark:text-black font-semibold text-xs shrink-0">
                  0 KB WAN DATA
                </div>
              </div>
            </div>
          </Show>
        </div>
      </section>

      {/* Active Tournament Status Box */}
      <section class="px-4 sm:px-6 max-w-5xl mx-auto w-full mb-16">
        <div class="border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-[#09090b]">
          <div class="px-5 py-3 bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
            <span class="font-semibold text-neutral-900 dark:text-white tracking-tight">
              CURRENT CONTEST STATUS
            </span>

            <button
              onClick={() => props.onNavigate('scoreboard')}
              class="text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white flex items-center gap-1.5 font-medium transition"
            >
              <IconTrophy class="w-3.5 h-3.5" />
              <span>View Standings</span>
            </button>
          </div>

          <div class="p-5 sm:p-6">
            <Show
              when={!loading() && activeContest()}
              fallback={
                <div class="py-8 text-center space-y-3 px-4">
                  <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    No Scheduled Tournament Active
                  </h3>
                  <p class="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
                    Tournament rounds unlock when started by the organizer. You can practice in the Arena tab, configure squad rosters, or start a new round from the organizer dashboard.
                  </p>
                  <Show when={props.user?.role === 'admin'}>
                    <div class="pt-2">
                      <button
                        onClick={() => props.onNavigate('admin')}
                        class="px-4 py-2 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition"
                      >
                        Start Contest from Admin
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
                      <h2 class="text-base font-semibold text-neutral-900 dark:text-white">
                        {c().title}
                      </h2>
                      <span class="px-2 py-0.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700">
                        {c().is_paused ? 'Paused' : c().state === 'RUNNING' ? 'Running' : 'Upcoming'}
                      </span>
                    </div>

                    <div class="flex flex-wrap items-center gap-2.5 text-xs text-neutral-600 dark:text-neutral-400">
                      <span>
                        Scoring: <strong class="text-neutral-900 dark:text-white">{c().scoring === 'icpc' ? 'Standard Penalty' : c().scoring}</strong>
                      </span>
                      <span class="text-neutral-300 dark:text-neutral-700">/</span>
                      <span>
                        Format: <strong class="text-neutral-900 dark:text-white">{c().is_team_contest ? `Squads (${c().max_team_size} members)` : 'Individual'}</strong>
                      </span>
                      <span class="text-neutral-300 dark:text-neutral-700">/</span>
                      <span>
                        Scheduled Start: <strong class="text-neutral-900 dark:text-white">{formatIST(c().starts_at)}</strong>
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => props.onNavigate('contest')}
                      class="px-4 py-2 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition flex items-center justify-center gap-1.5 w-full md:w-auto"
                    >
                      <span>{c().state === 'RUNNING' ? 'Enter Contest Arena' : 'View Schedule'}</span>
                      <IconArrowRight class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </Show>
          </div>
        </div>
      </section>

      {/* Bento Grid Features: Inspired by Reference Image 2 */}
      <section class="px-4 sm:px-6 max-w-5xl mx-auto w-full mb-16">
        <div class="border border-neutral-300 dark:border-neutral-800 grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-neutral-300 dark:divide-neutral-800">
          {/* Bento Left: High-Contrast Telemetry Card */}
          <div class="md:col-span-5 p-6 bg-black text-white dark:bg-white dark:text-black flex flex-col justify-between">
            <div class="space-y-4">
              <div class="text-[11px] font-semibold tracking-widest uppercase opacity-70">
                ARCHITECTURE TELEMETRY
              </div>
              <div class="text-3xl sm:text-4xl font-extrabold tracking-tight">
                100% Air-Gapped
              </div>
              <p class="text-xs leading-relaxed opacity-80 font-normal">
                Engineered specifically for zero-trust local network environments. Runs without external cloud roundtrips, CDN fetches, or licensing phone-homes.
              </p>
            </div>

            <div class="pt-8 space-y-2 text-xs">
              <div class="flex justify-between items-center py-1.5 border-b border-white/20 dark:border-black/20">
                <span class="opacity-80">Isolation Model</span>
                <span class="font-semibold">Linux cgroups v2</span>
              </div>
              <div class="flex justify-between items-center py-1.5 border-b border-white/20 dark:border-black/20">
                <span class="opacity-80">Median Judge Latency</span>
                <span class="font-semibold">&lt; 10ms</span>
              </div>
              <div class="flex justify-between items-center py-1.5 border-b border-white/20 dark:border-black/20">
                <span class="opacity-80">External WAN Overhead</span>
                <span class="font-semibold">0 KB</span>
              </div>
            </div>
          </div>

          {/* Bento Right: Categorized Capabilities with Clean Rows */}
          <div class="md:col-span-7 divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-[#09090b]">
            <div class="p-6 space-y-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition cursor-default">
              <div class="flex items-center justify-between text-xs font-semibold text-neutral-900 dark:text-white">
                <span>FUNCTION-LEVEL SUBMISSIONS</span>
                <IconArrowRight class="w-3.5 h-3.5 text-neutral-400" />
              </div>
              <p class="text-xs text-neutral-500 leading-relaxed">
                LeetCode-style Solution class methods. Automatic test harnesses handle I/O parsing across Python, C++, Go, and Rust.
              </p>
            </div>

            <div class="p-6 space-y-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition cursor-default">
              <div class="flex items-center justify-between text-xs font-semibold text-neutral-900 dark:text-white">
                <span>ICPC PENALTY & FREEZE RULES</span>
                <IconArrowRight class="w-3.5 h-3.5 text-neutral-400" />
              </div>
              <p class="text-xs text-neutral-500 leading-relaxed">
                Full compliance with ACM-ICPC tournament rules including cumulative attempt penalties and scoreboard freezing.
              </p>
            </div>

            <div class="p-6 space-y-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition cursor-default">
              <div class="flex items-center justify-between text-xs font-semibold text-neutral-900 dark:text-white">
                <span>SANDBOXED KERNEL ENFORCEMENT</span>
                <IconArrowRight class="w-3.5 h-3.5 text-neutral-400" />
              </div>
              <p class="text-xs text-neutral-500 leading-relaxed">
                Untrusted code runs in isolated Linux namespaces with strict memory limits, CPU quotas, and seccomp-bpf syscall filters.
              </p>
            </div>

            <div class="p-6 space-y-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition cursor-default">
              <div class="flex items-center justify-between text-xs font-semibold text-neutral-900 dark:text-white">
                <span>ROLE-BASED SQUAD CONTROLS</span>
                <IconArrowRight class="w-3.5 h-3.5 text-neutral-400" />
              </div>
              <p class="text-xs text-neutral-500 leading-relaxed">
                Form and manage team rosters with cryptographically generated squad invite tokens and real-time member tracking.
              </p>
            </div>
          </div>
        </div>

        {/* 4-Stat Metric Boxed Ribbon */}
        <div class="border-x border-b border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-neutral-300 dark:divide-neutral-800 text-center py-6">
          <div class="p-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white">
              60+
            </div>
            <div class="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-1">
              Curated Problems
            </div>
            <div class="text-[11px] text-neutral-500 mt-0.5">
              Easy, Medium, and Hard
            </div>
          </div>

          <div class="p-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white">
              &lt; 10ms
            </div>
            <div class="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-1">
              Event Dispatch
            </div>
            <div class="text-[11px] text-neutral-500 mt-0.5">
              Embedded NATS JetStream
            </div>
          </div>

          <div class="p-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white">
              256 MB
            </div>
            <div class="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-1">
              Sandbox Jail
            </div>
            <div class="text-[11px] text-neutral-500 mt-0.5">
              Strict memory isolation
            </div>
          </div>

          <div class="p-3">
            <div class="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white">
              5
            </div>
            <div class="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-1">
              Languages
            </div>
            <div class="text-[11px] text-neutral-500 mt-0.5">
              C++, Python, Go, Rust, C
            </div>
          </div>
        </div>
      </section>

      {/* Clean Minimalist Footer */}
      <footer class="mt-auto py-6 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black text-xs text-neutral-500">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 flex items-center justify-center text-neutral-900 dark:text-white">
              <IconBenchLogo class="w-5 h-5" />
            </div>
            <span class="font-semibold text-neutral-900 dark:text-white">CodeBench</span>
            <span>/</span>
            <span>Offline Coding Competition Platform</span>
          </div>
          <div class="flex items-center gap-4">
            <span>Timezone: Asia/Kolkata (IST)</span>
            <a
              href="https://github.com/Shridharrrr/CodeBench"
              target="_blank"
              rel="noopener noreferrer"
              class="hover:text-black dark:hover:text-white transition font-medium"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
