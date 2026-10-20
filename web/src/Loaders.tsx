import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';
import { IconAlertCircle, IconRefresh, IconServer } from './icons';

/**
 * High-performance inline button spinner for tactile workstation buttons
 */
export function ButtonSpinner(props: { class?: string }) {
  return (
    <svg
      class={`animate-spin ${props.class || "w-3.5 h-3.5 text-current"}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="3"
      />
      <path
        class="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Top neon edge progress bar that glows during background refreshes or API syncing
 */
export function TopProgressBar(props: { active: boolean }) {
  return (
    <Show when={props.active}>
      <div class="fixed top-0 left-0 right-0 h-[2px] z-50 bg-blue-500/20 overflow-hidden">
        <div class="h-full bg-blue-500 animate-[shimmerWave_1.2s_infinite_linear] w-full origin-left shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
      </div>
    </Show>
  );
}

/**
 * Authentic CRT Terminal Sandbox Compilation & Execution Loader
 * Simulates real kernel-level sandbox and compiler pipeline stages.
 */
export function CrtTerminalLoader(props: {
  mode: 'run' | 'submit';
  language?: string;
  testCount?: number;
  totalTests?: number;
  onCancel?: () => void;
}) {
  const [activeStep, setActiveStep] = createSignal(1);
  const [elapsedMs, setElapsedMs] = createSignal(40);
  const glyphs = ['|', '/', '—', '\\'];
  const [glyphIdx, setGlyphIdx] = createSignal(0);

  const steps = () =>
    props.mode === 'submit'
      ? [
          { num: 1, title: 'Allocating Linux Sandbox Namespace', desc: 'CLONE_NEWPID | CLONE_NEWNET | CLONE_NEWNS' },
          { num: 2, title: 'Invoking Compiler Toolchain', desc: `${props.language || 'Toolchain'} with -O3 -Wall -Wextra` },
          { num: 3, title: 'Enforcing cgroups v2 Quotas', desc: 'memory.max=256MB, cpu.max=1000000 1000000' },
          { num: 4, title: `Judging Test Suite (${props.testCount || 1}/${props.totalTests || 32})`, desc: 'Seccomp-BPF syscall whitelist verification' },
        ]
      : [
          { num: 1, title: 'Spawning Isolated Process Sandbox', desc: 'Restricted UID:GID 10001:10001' },
          { num: 2, title: 'Compiling Source Binary', desc: `${props.language || 'Compiler'} build target` },
          { num: 3, title: 'Executing Against Sample Vectors', desc: 'Pipes stdin / captures stdout under strict timer' },
          { num: 4, title: 'Comparing Validator Output', desc: 'Tokenized whitespace-invariant diffing' },
        ];

  onMount(() => {
    const stepTimer = setInterval(() => {
      setActiveStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 450);

    const glyphTimer = setInterval(() => {
      setGlyphIdx((prev) => (prev + 1) % glyphs.length);
      setElapsedMs((prev) => prev + 50);
    }, 100);

    onCleanup(() => {
      clearInterval(stepTimer);
      clearInterval(glyphTimer);
    });
  });

  return (
    <div class="p-4 bg-[#0a0c10] border border-zinc-800 rounded-[2px] font-mono text-xs text-zinc-300 shadow-[2px_2px_0px_rgba(0,0,0,0.5)]">
      {/* Terminal Title Bar */}
      <div class="flex items-center justify-between pb-2 mb-3 border-b border-zinc-800 text-[11px] text-zinc-400">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span class="font-bold text-zinc-200">
            {props.mode === 'submit' ? 'JUDGE_PIPELINE // OFFICIAL_SUBMISSION' : 'RUNNER // SAMPLE_EXECUTION'}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-zinc-500">{elapsedMs()}ms</span>
          <span class="text-amber-400 font-bold">{glyphs[glyphIdx()]}</span>
        </div>
      </div>

      {/* Progressive Telemetry Steps */}
      <div class="space-y-2 mb-4">
        <For each={steps()}>
          {(step) => {
            const isDone = () => activeStep() > step.num;
            const isCurrent = () => activeStep() === step.num;
            return (
              <div
                class={`flex items-start gap-2.5 p-1.5 rounded-[2px] transition-colors ${
                  isCurrent()
                    ? 'bg-zinc-900 border border-zinc-700 text-white'
                    : isDone()
                    ? 'text-zinc-400'
                    : 'text-zinc-600 opacity-60'
                }`}
              >
                <div class="w-4 h-4 rounded-xs shrink-0 flex items-center justify-center font-bold text-[10px]">
                  {isDone() ? (
                    <span class="text-emerald-400 font-bold">✓</span>
                  ) : isCurrent() ? (
                    <span class="text-amber-400 animate-pulse">▶</span>
                  ) : (
                    <span class="text-zinc-600">{step.num}</span>
                  )}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <span class="font-semibold text-[11px]">{step.title}</span>
                    <Show when={isCurrent()}>
                      <span class="text-[9px] px-1 py-0.2 rounded-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        PROCESSING
                      </span>
                    </Show>
                  </div>
                  <div class="text-[10px] text-zinc-500 truncate">{step.desc}</div>
                </div>
              </div>
            );
          }}
        </For>
      </div>

      {/* Progress Bar */}
      <div class="w-full bg-zinc-900 h-1.5 rounded-[1px] overflow-hidden border border-zinc-800">
        <div
          class="h-full bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 transition-all duration-300"
          style={{ width: `${(activeStep() / 4) * 100}%` }}
        />
      </div>

      <div class="mt-2.5 flex items-center justify-between text-[10px] text-zinc-500">
        <span>Kernel: Linux seccomp-bpf isolated</span>
        <span>Awaiting judge socket verdict<span class="terminal-cursor" /></span>
      </div>
    </div>
  );
}

/**
 * Shimmering Problem Panel Skeleton
 */
export function ProblemSkeletonLoader() {
  return (
    <div class="space-y-5 animate-pulse">
      {/* Title & Metadata Skeleton */}
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <div class="h-5 w-8 rounded-[2px] skeleton-shimmer" />
          <div class="h-6 w-56 rounded-[2px] skeleton-shimmer" />
          <div class="h-5 w-16 rounded-[2px] skeleton-shimmer ml-auto" />
        </div>
        <div class="flex items-center gap-3">
          <div class="h-4 w-28 rounded-[2px] skeleton-shimmer" />
          <div class="h-4 w-32 rounded-[2px] skeleton-shimmer" />
          <div class="h-4 w-24 rounded-[2px] skeleton-shimmer" />
        </div>
      </div>

      {/* Resource Quota Box */}
      <div class="h-16 w-full rounded-[2px] border border-[#d4d6dc] dark:border-[#272b34] skeleton-shimmer" />

      {/* Paragraph blocks */}
      <div class="space-y-2.5 pt-2">
        <div class="h-3.5 w-full rounded-[2px] skeleton-shimmer" />
        <div class="h-3.5 w-11/12 rounded-[2px] skeleton-shimmer" />
        <div class="h-3.5 w-4/5 rounded-[2px] skeleton-shimmer" />
        <div class="h-3.5 w-9/12 rounded-[2px] skeleton-shimmer" />
      </div>

      <div class="space-y-2 pt-2">
        <div class="h-4 w-32 rounded-[2px] skeleton-shimmer" />
        <div class="h-3.5 w-full rounded-[2px] skeleton-shimmer" />
        <div class="h-3.5 w-3/4 rounded-[2px] skeleton-shimmer" />
      </div>

      {/* Sample Cases Box */}
      <div class="space-y-3 pt-3">
        <div class="h-4 w-36 rounded-[2px] skeleton-shimmer" />
        <div class="h-28 w-full rounded-[2px] border border-[#d4d6dc] dark:border-[#272b34] skeleton-shimmer" />
        <div class="h-28 w-full rounded-[2px] border border-[#d4d6dc] dark:border-[#272b34] skeleton-shimmer" />
      </div>
    </div>
  );
}

/**
 * Shimmering Table Rows Skeleton (Scoreboard & Squads)
 */
export function TableSkeletonLoader(props: { rows?: number; columns?: number }) {
  const rowCount = () => props.rows || 6;

  return (
    <div class="notion-card bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] overflow-hidden rounded-[2px]">
      {/* Header bar skeleton */}
      <div class="h-10 bg-[#eaedf1] dark:bg-[#14171d] border-b border-[#d4d6dc] dark:border-[#262a32] flex items-center px-4 gap-4">
        <div class="h-3 w-12 rounded-[1px] skeleton-shimmer" />
        <div class="h-3 w-40 rounded-[1px] skeleton-shimmer" />
        <div class="h-3 w-20 rounded-[1px] skeleton-shimmer ml-auto" />
        <div class="h-3 w-24 rounded-[1px] skeleton-shimmer" />
      </div>

      {/* Body rows skeleton */}
      <div class="divide-y divide-[#d4d6dc] dark:divide-[#262a32]">
        <For each={Array.from({ length: rowCount() })}>
          {() => (
            <div class="py-3 px-4 flex items-center gap-4">
              <div class="h-5 w-7 rounded-[2px] skeleton-shimmer shrink-0" />
              <div class="h-4 w-44 rounded-[2px] skeleton-shimmer" />
              <div class="flex-1 flex justify-end gap-3">
                <div class="h-4 w-14 rounded-[2px] skeleton-shimmer" />
                <div class="h-4 w-20 rounded-[2px] skeleton-shimmer" />
                <div class="h-4 w-12 rounded-[2px] skeleton-shimmer" />
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

/**
 * Shimmering Metric Cards Skeleton (Admin Dashboard)
 */
export function AdminMetricsSkeleton() {
  return (
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <For each={[1, 2, 3, 4]}>
        {() => (
          <div class="p-4 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#272b34] rounded-[2px] space-y-2">
            <div class="h-3 w-20 rounded-[1px] skeleton-shimmer" />
            <div class="h-7 w-28 rounded-[2px] skeleton-shimmer" />
            <div class="h-2.5 w-36 rounded-[1px] skeleton-shimmer" />
          </div>
        )}
      </For>
    </div>
  );
}

/**
 * Reusable Humanized Error Boundary Card
 */
export function ErrorStateCard(props: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div class="notion-card p-8 bg-white dark:bg-[#111316] border border-rose-300 dark:border-rose-900/60 rounded-[2px] text-center max-w-md mx-auto my-6 space-y-3">
      <div class="w-10 h-10 rounded-[2px] bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900">
        <IconAlertCircle class="w-5 h-5" />
      </div>
      <h3 class="text-sm font-bold text-zinc-900 dark:text-zinc-100">
        {props.title || 'Engine Synchronization Error'}
      </h3>
      <p class="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans">
        {props.message ||
          'Failed to retrieve remote state. The server connection may have timed out or the judge worker pool is rebalancing.'}
      </p>
      <Show when={props.onRetry}>
        <div class="pt-2">
          <button
            onClick={props.onRetry}
            class="btn-workstation btn-workstation-secondary text-xs inline-flex items-center gap-1.5 px-3 py-1.5"
          >
            <IconRefresh class="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      </Show>
    </div>
  );
}

/**
 * Real-time System Heartbeat Status Pill (Navbar)
 * Monitors server time, ping latency, and judge engine status.
 */
export function SystemHeartbeatPill() {
  const [latencyMs, setLatencyMs] = createSignal<number>(12);
  const [isHealthy, setIsHealthy] = createSignal<boolean>(true);
  const [isOpen, setIsOpen] = createSignal<boolean>(false);

  const measureLatency = async () => {
    const start = performance.now();
    try {
      const res = await fetch('/healthz', { cache: 'no-store' });
      const end = performance.now();
      if (res.ok) {
        setLatencyMs(Math.round(end - start));
        setIsHealthy(true);
      } else {
        setIsHealthy(false);
      }
    } catch {
      setIsHealthy(false);
    }
  };

  onMount(() => {
    measureLatency();
    const interval = setInterval(measureLatency, 30000);
    onCleanup(() => clearInterval(interval));
  });

  return (
    <div class="relative">
      <button
        onClick={() => setIsOpen(!isOpen())}
        title="View System Telemetry & Cluster Status"
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] font-mono text-[10px] bg-zinc-100 dark:bg-[#16181f] text-zinc-600 dark:text-zinc-400 border border-[#d4d6dc] dark:border-[#272b34] hover:border-zinc-400 dark:hover:border-zinc-600 transition"
      >
        <span
          class={`w-1.5 h-1.5 rounded-full ${
            isHealthy() ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
          }`}
        />
        <span class="font-bold text-zinc-800 dark:text-zinc-200">
          {isHealthy() ? `${latencyMs()}ms` : 'OFFLINE'}
        </span>
      </button>

      {/* Flyout Telemetry Card */}
      <Show when={isOpen()}>
        <div class="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#272b34] rounded-[2px] p-3 shadow-lg z-50 text-xs font-mono space-y-2.5">
          <div class="flex items-center justify-between pb-1.5 border-b border-[#eaecf0] dark:border-[#222630]">
            <span class="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <IconServer class="w-3.5 h-3.5 text-blue-500" />
              <span>Node Telemetry</span>
            </span>
            <span
              class={`text-[9px] px-1 py-0.2 rounded-xs font-bold ${
                isHealthy()
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
              }`}
            >
              {isHealthy() ? 'ALL SYSTEMS OPERATIONAL' : 'DEGRADED'}
            </span>
          </div>

          <div class="space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            <div class="flex justify-between">
              <span>HTTP RTT:</span>
              <strong class="text-zinc-900 dark:text-zinc-200">{latencyMs()}ms</strong>
            </div>
            <div class="flex justify-between">
              <span>Event Broker:</span>
              <strong class="text-zinc-900 dark:text-zinc-200">NATS JetStream (Embed)</strong>
            </div>
            <div class="flex justify-between">
              <span>Judge Worker:</span>
              <strong class="text-emerald-600 dark:text-emerald-400">cgroups v2 Strict</strong>
            </div>
            <div class="flex justify-between">
              <span>Timing Canary:</span>
              <strong class="text-zinc-900 dark:text-zinc-200">Active (15% Jitter Tol)</strong>
            </div>
          </div>

          <div class="pt-1 border-t border-[#eaecf0] dark:border-[#222630] text-[10px] text-zinc-500">
            Monotonic host clock synchronized with API server.
          </div>
        </div>
      </Show>
    </div>
  );
}
