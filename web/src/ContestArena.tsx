import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { getBoilerplate } from './templates';
import WaitingRoom from './WaitingRoom';
import MarkdownView from './MarkdownView';
import CodeEditor from './CodeEditor';
import {
  IconCheck,
  IconX,
  IconPlay,
  IconClock,
} from './icons';
import {
  ProblemSkeletonLoader,
  CrtTerminalLoader,
  ButtonSpinner,
  TopProgressBar,
} from './Loaders';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface ContestSummary {
  id: string;
  title: string;
  mode: string;
  starts_at: string;
  ends_at: string;
  freeze_at?: string;
  scoring: string;
  server_time: string;
  state: 'upcoming' | 'running' | 'ended' | 'PAUSED';
  time_remaining_ms: number;
  problem_count: number;
  participant_count: number;
  is_paused?: boolean;
  is_team_contest?: boolean;
  max_team_size?: number;
  user_team?: any;
}

export interface ContestProblemSummary {
  label: string;
  points: number;
  title?: string;
  slug?: string;
  difficulty?: string;
}

export interface ComplexityPolicy {
  policy?: string;
  time_complexity?: string;
  space_complexity?: string;
  max_queries?: number;
  budget_formula?: string;
}

export interface ContestProblemDetail {
  label: string;
  points: number;
  title: string;
  slug: string;
  difficulty: string;
  statement_md: string;
  time_limit_ms: number;
  memory_mb: number;
  checker_type: string;
  complexity_policy?: ComplexityPolicy;
  sample_tests: Array<{
    ordinal: number;
    group_name: string;
    input_data: string;
    output_data: string;
  }>;
}

export interface ProblemCell {
  label: string;
  solved: boolean;
  solved_time_minutes?: number;
  attempt_count: number;
  points: number;
  is_frozen: boolean;
}

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  user_name: string;
  score: number;
  penalty: number;
  adjustments?: number;
  last_ac_time?: string;
  problems: Record<string, ProblemCell>;
}

export interface Leaderboard {
  contest_id: string;
  is_frozen: boolean;
  updated_at: string;
  rows: LeaderboardRow[];
}

interface ContestArenaProps {
  user: UserProfile | null;
  csrfToken: string;
  onOpenAuth: () => void;
  onContestLockChange?: (locked: boolean) => void;
}

export default function ContestArena(props: ContestArenaProps) {
  // Contests State
  const [contests, setContests] = createSignal<ContestSummary[]>([]);
  const [selectedContestId, setSelectedContestId] = createSignal<string>('');
  const [activeContest, setActiveContest] = createSignal<ContestSummary | null>(null);
  const [isRegistered, setIsRegistered] = createSignal(false);
  const [problems, setProblems] = createSignal<ContestProblemSummary[]>([]);
  const [selectedLabel, setSelectedLabel] = createSignal<string>('A');
  const [problemDetail, setProblemDetail] = createSignal<ContestProblemDetail | null>(null);
  const [problemLoading, setProblemLoading] = createSignal(false);
  const [problemError, setProblemError] = createSignal<string | null>(null);

  // Synced Timer State
  const [timeRemainingSec, setTimeRemainingSec] = createSignal<number>(0);
  const [timerText, setTimerText] = createSignal<string>('00:00:00');
  const [timerStatusLabel, setTimerStatusLabel] = createSignal<string>('Ends in');

  // Code Editor State
  const [language, setLanguage] = createSignal('cpp23-gcc');
  const [sourceCode, setSourceCode] = createSignal('');
  const [activeTab, setActiveTab] = createSignal<'cases' | 'output' | 'verdict'>('cases');
  const [selectedCaseIndex, setSelectedCaseIndex] = createSignal<number>(0);
  const [useCustomInput, setUseCustomInput] = createSignal(false);
  const [customInputText, setCustomInputText] = createSignal('');

  // Execution & Progress
  const [isRunning, setIsRunning] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [sampleRunResult, setSampleRunResult] = createSignal<any | null>(null);
  const [submissionVerdict, setSubmissionVerdict] = createSignal<any | null>(null);
  const [, setSubmissionStage] = createSignal<string>('IDLE');
  const [evaluatingTestCount, setEvaluatingTestCount] = createSignal<number>(0);

  // Solved Cache
  const [problemStatuses, setProblemStatuses] = createSignal<Record<string, string>>({});

  // Leaderboard Freeze indicator
  const [leaderboard, setLeaderboard] = createSignal<Leaderboard | null>(null);

  // Resizable Panes State (horizontal splitX % for problem statement, vertical splitY % for code editor)
  const [splitX, setSplitX] = createSignal<number>(45);
  const [splitY, setSplitY] = createSignal<number>(60);
  const [, setIsDraggingX] = createSignal<boolean>(false);
  const [, setIsDraggingY] = createSignal<boolean>(false);

  // Responsive Viewports & Mobile Pane Mode
  const [mobileView, setMobileView] = createSignal<'statement' | 'editor' | 'console'>('statement');
  const [isDesktop, setIsDesktop] = createSignal<boolean>(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);

  let workspaceRef: HTMLDivElement | undefined;
  let rightPaneRef: HTMLDivElement | undefined;

  const handleStartDragX = (e: PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setIsDraggingX(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!workspaceRef) return;
      const rect = workspaceRef.getBoundingClientRect();
      if (rect.width <= 0) return;
      const newPercent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setSplitX(Math.max(20, Math.min(80, newPercent)));
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      try { target.releasePointerCapture(upEvent.pointerId); } catch {}
      setIsDraggingX(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const handleStartDragY = (e: PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setIsDraggingY(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!rightPaneRef) return;
      const rect = rightPaneRef.getBoundingClientRect();
      if (rect.height <= 0) return;
      const newPercent = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setSplitY(Math.max(15, Math.min(85, newPercent)));
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      try { target.releasePointerCapture(upEvent.pointerId); } catch {}
      setIsDraggingY(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  let countdownInterval: any = null;
  let contestEventSource: EventSource | null = null;

  onMount(() => {
    fetchContests();

    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          handleContestSubmit();
        } else {
          handleRunSamples();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Periodic sync interval ensures questions appear automatically when admin starts contest without refresh
    const autoSyncInterval = setInterval(() => {
      const id = selectedContestId();
      if (id) {
        const c = activeContest();
        if (!c || c.state === 'upcoming' || c.state === 'UPCOMING' || problems().length === 0) {
          fetchContestDetail(id);
        }
      }
    }, 2500);

    onCleanup(() => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(autoSyncInterval);
      if (countdownInterval) clearInterval(countdownInterval);
      if (contestEventSource) contestEventSource.close();
    });
  });

  const fetchContests = async () => {
    try {
      const res = await fetch('/api/contests');
      if (res.ok) {
        const data = await res.json();
        setContests(data || []);
        if (data && data.length > 0 && !selectedContestId()) {
          setSelectedContestId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch contests', e);
    }
  };

  createEffect(() => {
    const id = selectedContestId();
    if (!id) return;

    fetchContestDetail(id);
    fetchLeaderboard(id);

    if (contestEventSource) contestEventSource.close();
    contestEventSource = new EventSource(`/api/contests/${id}/events`);
    contestEventSource.addEventListener('submission_update', () => {
      fetchLeaderboard(id);
    });
    contestEventSource.addEventListener('leaderboard_update', () => {
      fetchLeaderboard(id);
    });
    contestEventSource.addEventListener('contest_started', () => {
      fetchContestDetail(id);
    });
    contestEventSource.addEventListener('contest_updated', () => {
      fetchContestDetail(id);
    });
  });

  const fetchContestDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/contests/${id}`);
      if (res.ok) {
        const data: ContestSummary & { is_registered: boolean; problems: ContestProblemSummary[] } =
          await res.json();
        setActiveContest(data);
        setIsRegistered(data.is_registered);
        setProblems(data.problems || []);

        // Notify parent whether contest is actively locked
        const st = String(data.state || '').toUpperCase();
        const isLive = (st === 'RUNNING' || st === 'FROZEN') && !data.is_paused;
        props.onContestLockChange?.(isLive);

        // Auto-select first question if none selected or invalid label (eliminates blank state!)
        if (data.problems && data.problems.length > 0) {
          const currentValid = data.problems.some((p) => p.label === selectedLabel());
          const targetLabel = currentValid && problemDetail() ? selectedLabel() : data.problems[0].label;
          setSelectedLabel(targetLabel);
          fetchProblemDetail(id, targetLabel);
        }
        setupTimer(data);
      }
    } catch (e) {
      console.error('Failed to fetch contest detail', e);
    }
  };

  const setupTimer = (c: ContestSummary) => {
    if (countdownInterval) clearInterval(countdownInterval);

    const updateTimer = () => {
      const now = Date.now();
      const startsAt = new Date(c.starts_at).getTime();
      const endsAt = new Date(c.ends_at).getTime();

      if (c.is_paused) {
        setTimerStatusLabel('Paused');
        setTimerText('PAUSED');
        setTimeRemainingSec(0);
        return;
      }

      if (now < startsAt) {
        setTimerStatusLabel('Starts in');
        const diffSec = Math.max(0, Math.floor((startsAt - now) / 1000));
        setTimeRemainingSec(diffSec);
        setTimerText(formatSec(diffSec));
      } else if (now < endsAt) {
        setTimerStatusLabel('Ends in');
        const diffSec = Math.max(0, Math.floor((endsAt - now) / 1000));
        setTimeRemainingSec(diffSec);
        setTimerText(formatSec(diffSec));
      } else {
        setTimerStatusLabel('Ended');
        setTimerText('00:00:00');
        setTimeRemainingSec(0);
      }
    };

    updateTimer();
    countdownInterval = setInterval(updateTimer, 1000);
  };

  const formatSec = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  createEffect(() => {
    const contestId = selectedContestId();
    const label = selectedLabel();
    if (!contestId || !label) return;

    fetchProblemDetail(contestId, label);
  });

  const fetchProblemDetail = async (contestId: string, label: string) => {
    setProblemLoading(true);
    setProblemError(null);
    try {
      const res = await fetch(`/api/contests/${contestId}/problems/${label}`);
      if (res.ok) {
        const data: ContestProblemDetail = await res.json();
        setProblemDetail(data);

        // Restore draft if saved, otherwise load clean starter skeleton
        const savedDraft = localStorage.getItem(`cb_contest_${contestId}_${label}_${language()}`);
        if (savedDraft) {
          setSourceCode(savedDraft);
        } else {
          setSourceCode(getBoilerplate(data.slug, language()));
        }
      } else {
        const err = await res.json();
        setProblemError(err.error || 'Failed to fetch problem detail.');
        setProblemDetail(null);
      }
    } catch {
      setProblemError('Network failure fetching problem specification.');
    } finally {
      setProblemLoading(false);
    }
  };

  const fetchLeaderboard = async (contestId: string) => {
    try {
      const res = await fetch(`/api/contests/${contestId}/leaderboard`);
      if (res.ok) {
        const data: Leaderboard = await res.json();
        setLeaderboard(data);

        // Update solved cache
        if (props.user && data.rows) {
          const userRow = data.rows.find((r) => r.user_id === props.user?.id);
          if (userRow && userRow.problems) {
            const statuses: Record<string, string> = {};
            for (const [lbl, cell] of Object.entries(userRow.problems)) {
              if (cell.solved) statuses[lbl] = 'AC';
              else if (cell.is_frozen) statuses[lbl] = 'FROZEN';
              else if (cell.attempt_count > 0) statuses[lbl] = 'WA';
            }
            setProblemStatuses(statuses);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard', e);
    }
  };

  const handleJoinContest = async () => {
    if (!props.user) {
      props.onOpenAuth();
      return;
    }
    const id = selectedContestId();
    if (!id) return;
    try {
      const res = await fetch(`/api/contests/${id}/join`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': props.csrfToken },
      });
      if (res.ok) {
        setIsRegistered(true);
        fetchContestDetail(id);
      }
    } catch (e) {
      console.error('Failed to join contest', e);
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const contestId = selectedContestId();
    const label = selectedLabel();
    const savedDraft = localStorage.getItem(`cb_contest_${contestId}_${label}_${newLang}`);
    if (savedDraft) {
      setSourceCode(savedDraft);
    } else {
      const detail = problemDetail();
      setSourceCode(getBoilerplate(detail?.slug || '', newLang));
    }
  };

  const handleResetBoilerplate = () => {
    if (confirm('Reset editor to clean starter boilerplate?')) {
      const detail = problemDetail();
      const code = getBoilerplate(detail?.slug || '', language());
      setSourceCode(code);
      handleCodeChange(code);
    }
  };

  const handleCodeChange = (val: string) => {
    setSourceCode(val);
    const contestId = selectedContestId();
    const label = selectedLabel();
    if (contestId && label) {
      localStorage.setItem(`cb_contest_${contestId}_${label}_${language()}`, val);
    }
  };

  // Run Code against visible samples
  const handleRunSamples = async () => {
    const detail = problemDetail();
    if (!detail) return;

    setIsRunning(true);
    setActiveTab('output');
    setMobileView('console');
    setSampleRunResult(null);

    try {
      const res = await fetch(`/api/problems/${detail.slug}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: language(),
          source: sourceCode(),
          custom_input: useCustomInput() ? customInputText() : '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSampleRunResult(data);
      } else {
        const err = await res.json();
        setSampleRunResult({
          status: 'ERROR',
          verdict: 'CE',
          compile_output: err.error || 'Execution failed',
          sample_results: [],
        });
      }
    } catch {
      setSampleRunResult({
        status: 'ERROR',
        verdict: 'SE',
        compile_output: 'Network failure communicating with execution runner.',
        sample_results: [],
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Submit Official Solution
  const handleContestSubmit = async () => {
    if (!props.user) {
      props.onOpenAuth();
      return;
    }
    const contestId = selectedContestId();
    const label = selectedLabel();
    if (!contestId || !label) return;

    setIsSubmitting(true);
    setActiveTab('verdict');
    setMobileView('console');
    setSubmissionStage('QUEUED');
    setSubmissionVerdict(null);
    setEvaluatingTestCount(1);

    try {
      const res = await fetch(`/api/contests/${contestId}/problems/${label}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify({
          language: language(),
          source: sourceCode(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setSubmissionVerdict({
          status: 'DONE',
          verdict: 'REJECTED',
          compile_output: err.error || 'Submission rejected by contest rules',
        });
        setIsSubmitting(false);
        return;
      }

      const data = await res.json();
      const subId = data.submission_id;

      // Subscribe to submission SSE for live progress
      const subSse = new EventSource(`/api/submissions/${subId}/events`);
      let progressTimer = setInterval(() => {
        setEvaluatingTestCount((prev) => (prev < 30 ? prev + 1 : prev));
      }, 250);

      subSse.addEventListener('submission_update', (e) => {
        try {
          const evData = JSON.parse(e.data);
          if (evData.status) {
            setSubmissionStage(evData.status);
          }
          if (evData.status === 'DONE') {
            clearInterval(progressTimer);
            subSse.close();
            setIsSubmitting(false);
            fetchSubmissionVerdict(subId);
            fetchLeaderboard(contestId);
          }
        } catch (err) {
          console.error('Error handling submission SSE', err);
        }
      });

      subSse.onerror = () => {
        clearInterval(progressTimer);
        subSse.close();
        setIsSubmitting(false);
        fetchSubmissionVerdict(subId);
      };
    } catch {
      setSubmissionVerdict({
        status: 'DONE',
        verdict: 'SE',
        compile_output: 'Failed to dispatch submission to judge pipeline.',
      });
      setIsSubmitting(false);
    }
  };

  const fetchSubmissionVerdict = async (subId: string) => {
    try {
      const res = await fetch(`/api/submissions/${subId}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissionVerdict(data);
        if (data.verdict === 'AC') {
          setProblemStatuses((prev) => ({ ...prev, [selectedLabel()]: 'AC' }));
        } else if (problemStatuses()[selectedLabel()] !== 'AC') {
          setProblemStatuses((prev) => ({ ...prev, [selectedLabel()]: 'WA' }));
        }
      }
    } catch (e) {
      console.error('Failed to fetch submission verdict', e);
    }
  };


  // Check if contest is active and running
  const isContestRunning = () => {
    const c = activeContest();
    if (!c) return false;
    const isAdmin = props.user?.role === 'admin';
    if (isAdmin) return true; // Admin can preview problems
    const state = (c.state || '').toUpperCase();
    return (state === 'RUNNING' || state === 'FROZEN') && !c.is_paused;
  };

  return (
    <div class="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-white dark:bg-black relative">
      <TopProgressBar active={isRunning() || isSubmitting()} />
      <Show
        when={contests().length > 0 && activeContest()}
        fallback={
          <div class="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-black">
            <div class="w-16 h-16 rounded-none bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 flex items-center justify-center mx-auto mb-4">
              <IconClock class="w-8 h-8" />
            </div>
            <h2 class="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">Competition Not Started</h2>
            <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-2 max-w-md mx-auto leading-relaxed">
              There is currently no active competition running. The arena will unlock once a round is configured and launched by the organizer.
            </p>
          </div>
        }
      >
        <Show
          when={isContestRunning()}
          fallback={
            <WaitingRoom
              contest={activeContest()!}
              user={props.user}
              csrfToken={props.csrfToken}
              onOpenAuth={props.onOpenAuth}
              onContestStarted={() => {
                if (selectedContestId()) fetchContestDetail(selectedContestId());
              }}
            />
          }
        >
          {/* Contest Top Banner (Only visible when contest is running) */}
          <header class="min-h-11 sm:h-12 py-1.5 sm:py-0 border-b border-neutral-200 dark:border-neutral-800 px-3 sm:px-5 flex items-center justify-between bg-white dark:bg-black z-20 gap-2">
            <div class="flex items-center gap-2 sm:gap-3 min-w-0">
              <Show
                when={contests().length > 1}
                fallback={
                  <span class="font-bold text-xs uppercase text-neutral-900 dark:text-white tracking-tight truncate max-w-[140px] sm:max-w-none">
                    {activeContest()?.title}
                  </span>
                }
              >
                <select
                  value={selectedContestId()}
                  onChange={(e) => setSelectedContestId(e.currentTarget.value)}
                  class="notion-input font-semibold text-xs py-1 rounded-none"
                >
                  <For each={contests()}>
                    {(c) => (
                      <option value={c.id}>
                        {c.title} ({c.scoring.toUpperCase()})
                      </option>
                    )}
                  </For>
                </select>
              </Show>

              <Show when={activeContest()}>
                {(c) => (
                  <div class="flex items-center gap-2">
                    <span
                      class={`px-2.5 py-0.5 rounded-none text-xs font-semibold uppercase tracking-wider ${
                        c().state === 'running'
                          ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700'
                          : c().state === 'upcoming'
                          ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700'
                          : c().state === 'PAUSED'
                          ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700'
                          : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700'
                      }`}
                    >
                      {c().is_paused ? 'Paused' : (c().state === 'running' ? 'Running' : 'Upcoming')}
                    </span>

                    <span class="hidden md:inline text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                      {c().scoring.toUpperCase()} &bull; {c().problem_count} Problems
                    </span>
                  </div>
                )}
              </Show>
            </div>

            {/* Central Synced Countdown Clock */}
            <div class="flex items-center gap-3">
              <div class="digital-clock-box">
                <span class="text-[10px] uppercase font-semibold text-neutral-500 dark:text-neutral-400">{timerStatusLabel()}:</span>
                <span
                  class={`text-xs font-bold tracking-wider ${
                    timeRemainingSec() < 300 && timeRemainingSec() > 0
                      ? 'text-neutral-900 dark:text-white underline'
                      : 'text-neutral-900 dark:text-white'
                  }`}
                >
                  {timerText()}
                </span>
              </div>

              <Show when={leaderboard()?.is_frozen}>
                <span class="px-2.5 py-0.5 rounded-none text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 uppercase tracking-wider">
                  Frozen
                </span>
              </Show>
            </div>

            {/* Header Actions */}
            <div class="flex items-center gap-2">
              <Show
                when={isRegistered()}
                fallback={
                  <button
                    onClick={handleJoinContest}
                    class="btn-workstation-primary px-3.5 py-1.5 rounded-none text-xs font-semibold"
                  >
                    Join Contest
                  </button>
                }
              >
                <span class="px-2.5 py-0.5 rounded-none text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 inline-flex items-center gap-1.5">
                  <IconCheck class="w-3 h-3 text-neutral-900 dark:text-neutral-100" />
                  <span>Registered</span>
                </span>
              </Show>
            </div>
          </header>

          {/* Problem Letter Tabs Banner */}
          <div class="h-10 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 px-3 sm:px-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <For each={problems()}>
              {(p) => {
                const isSelected = () => selectedLabel() === p.label;
                const status = () => problemStatuses()[p.label];
                return (
                  <button
                    onClick={() => {
                      setSelectedLabel(p.label);
                      setMobileView('statement');
                    }}
                    class={`flex items-center gap-2 px-3 py-1 text-xs rounded-none border transition shrink-0 ${
                      isSelected()
                        ? 'bg-black dark:bg-white text-white dark:text-black font-semibold border-black dark:border-white'
                        : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <span
                      class={`px-1.5 py-0.5 rounded-none text-[10px] font-bold border ${
                        status() === 'AC'
                          ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white'
                          : status() === 'WA'
                          ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700'
                          : isSelected()
                          ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-black border-transparent'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
                      }`}
                    >
                      <Show
                        when={status() === 'AC'}
                        fallback={
                          <Show when={status() === 'WA'} fallback={p.label}>
                            <IconX class="w-3 h-3 text-current inline-block" />
                          </Show>
                        }
                      >
                        <IconCheck class="w-3 h-3 text-current inline-block" />
                      </Show>
                    </span>
                    <span class="font-semibold">{p.title || `Problem ${p.label}`}</span>
                    <span class={`text-[10px] ${isSelected() ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400 dark:text-neutral-500'}`}>
                      ({p.points}p)
                    </span>
                  </button>
                );
              }}
            </For>
          </div>

          {/* Mobile View Mode Switcher (< lg only) */}
          <div class="flex lg:hidden items-center justify-between px-3 py-1.5 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 text-xs">
            <div class="flex items-center gap-1 bg-white dark:bg-black p-0.5 rounded-none border border-neutral-300 dark:border-neutral-800 w-full font-medium">
              <button
                onClick={() => setMobileView('statement')}
                class={`flex-1 py-1 text-center rounded-none transition ${
                  mobileView() === 'statement'
                    ? 'bg-black dark:bg-white text-white dark:text-black font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Problem
              </button>
              <button
                onClick={() => setMobileView('editor')}
                class={`flex-1 py-1 text-center rounded-none transition ${
                  mobileView() === 'editor'
                    ? 'bg-black dark:bg-white text-white dark:text-black font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Code Editor
              </button>
              <button
                onClick={() => setMobileView('console')}
                class={`flex-1 py-1 text-center rounded-none transition ${
                  mobileView() === 'console'
                    ? 'bg-black dark:bg-white text-white dark:text-black font-semibold'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'
                }`}
              >
                Console & Runs
              </button>
            </div>
          </div>

        {/* Dual Pane Ergonomic Workspace with Resizable Splitters */}
        <div ref={workspaceRef} class="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Left Pane: Independently Scrollable Problem Statement */}
          <div
            style={{ width: isDesktop() ? `${splitX()}%` : '100%' }}
            class={`border-r border-neutral-200 dark:border-neutral-800 flex-col min-w-0 min-h-0 h-full overflow-y-auto bg-white dark:bg-black p-4 sm:p-6 space-y-5 ${
              isDesktop() || mobileView() === 'statement' ? 'flex' : 'hidden'
            }`}
          >
            <Show when={problemLoading()}>
              <div class="py-2">
                <ProblemSkeletonLoader />
              </div>
            </Show>

            <Show when={problemError()}>
              <div class="p-3.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 rounded-none text-neutral-900 dark:text-neutral-100 text-xs font-sans">
                <strong>Notice:</strong> {problemError()}
              </div>
            </Show>

            <Show when={!problemLoading() && !problemError() && problemDetail()}>
              {(p) => (
                <div class="space-y-5">
                  {/* Header & Badges */}
                  <div class="pb-3 border-b border-neutral-200 dark:border-neutral-800 space-y-2">
                    <div class="flex items-center justify-between">
                      <h1 class="text-lg font-bold text-neutral-900 dark:text-white">
                        Problem {p().label}. {p().title}
                      </h1>
                      <span
                        class="status-chip bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
                      >
                        {p().difficulty}
                      </span>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>Time: <strong class="text-neutral-800 dark:text-neutral-200">{p().time_limit_ms}ms</strong></span>
                      <span class="text-neutral-300 dark:text-neutral-700">&bull;</span>
                      <span>Memory: <strong class="text-neutral-800 dark:text-neutral-200">{p().memory_mb}MB</strong></span>
                      <span class="text-neutral-300 dark:text-neutral-700">&bull;</span>
                      <span>Points: <strong class="text-neutral-800 dark:text-neutral-200">{p().points}</strong></span>
                      <Show when={p().complexity_policy?.time_complexity}>
                        <span class="text-neutral-300 dark:text-neutral-700">&bull;</span>
                        <span class="status-chip bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700">
                          Expected: {p().complexity_policy?.time_complexity}
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* Properly Formatted Problem Statement Body */}
                  <MarkdownView content={p().statement_md} />

                  {/* Sample Testcases */}
                  <div class="space-y-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                    <span class="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Sample Test Cases
                    </span>

                    <For each={p().sample_tests}>
                      {(tc) => (
                        <div class="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-none space-y-2">
                          <div class="flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                            <span>Sample Case {tc.ordinal}</span>
                          </div>
                          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <div class="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                                Input:
                              </div>
                              <pre class="bg-white dark:bg-black p-2.5 rounded-none border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-neutral-200 max-h-48 overflow-y-auto overflow-x-auto whitespace-pre block">
                                {tc.input_data}
                              </pre>
                            </div>
                            <div>
                              <div class="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                                Expected Output:
                              </div>
                              <pre class="bg-white dark:bg-black p-2.5 rounded-none border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-neutral-200 font-bold max-h-48 overflow-y-auto overflow-x-auto whitespace-pre block">
                                {tc.output_data}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </Show>
          </div>

          {/* Horizontal Splitter Drag Handle between Problem and Code Panels */}
          <div
            onPointerDown={handleStartDragX}
            class={`w-2 shrink-0 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-400 dark:hover:bg-neutral-600 cursor-col-resize transition-colors items-center justify-center group relative z-20 select-none touch-none ${
              isDesktop() ? 'flex' : 'hidden'
            }`}
            title="Drag horizontally to resize problem description and code editor"
          >
            <div class="w-0.5 h-8 bg-neutral-400 dark:bg-neutral-600 group-hover:bg-black dark:group-hover:bg-white transition-colors" />
          </div>

          {/* Right Pane: Code Editor & Results Console */}
          <div
            ref={rightPaneRef}
            style={{ width: isDesktop() ? `${100 - splitX()}%` : '100%' }}
            class={`flex-col min-w-0 min-h-0 h-full overflow-hidden bg-white dark:bg-black ${
              isDesktop() || mobileView() !== 'statement' ? 'flex' : 'hidden'
            }`}
          >
            {/* Top Sub-Pane: Code Editor (Bounded & Scrollable) */}
            <div
              style={{ height: isDesktop() ? `${splitY()}%` : (mobileView() === 'editor' ? '100%' : '0%') }}
              class={`flex-col min-h-0 min-w-0 overflow-hidden ${
                isDesktop() || mobileView() === 'editor' ? 'flex' : 'hidden'
              }`}
            >
              {/* Editor Header Bar */}
              <div class="h-10 shrink-0 border-b border-neutral-200 dark:border-neutral-800 px-4 flex items-center justify-between bg-neutral-50 dark:bg-neutral-950 text-xs font-sans">
                <div class="flex items-center gap-3">
                  <select
                    value={language()}
                    onChange={(e) => handleLanguageChange(e.currentTarget.value)}
                    class="notion-input text-xs font-semibold py-1 rounded-none"
                  >
                    <option value="cpp23-gcc">C++23 (GCC 14)</option>
                    <option value="cpp23-clang">C++23 (Clang 18)</option>
                    <option value="c23-gcc">C23 (GCC 14)</option>
                    <option value="c23-clang">C23 (Clang 18)</option>
                    <option value="python3">Python 3.12</option>
                    <option value="rust">Rust 1.85</option>
                    <option value="go">Go 1.24</option>
                  </select>

                  <button
                    onClick={handleResetBoilerplate}
                    class="text-[11px] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition font-medium"
                  >
                    Reset Starter
                  </button>
                </div>

                <span class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  Problem {selectedLabel()}
                </span>
              </div>

              {/* Code Editor with Line Numbers & Real-Time Syntax Highlighting */}
              <div class="flex-1 min-h-0 min-w-0 relative overflow-hidden">
                <CodeEditor
                  value={sourceCode()}
                  onInput={(val) => handleCodeChange(val)}
                  language={language()}
                  placeholder="// Write your solution here..."
                  class="h-full w-full min-h-0 min-w-0 overflow-hidden"
                />
              </div>
            </div>

            {/* Vertical Splitter Drag Handle between Code Editor and Console */}
            <div
              onPointerDown={handleStartDragY}
              class={`h-2 shrink-0 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-400 dark:hover:bg-neutral-600 cursor-row-resize transition-colors items-center justify-center group relative z-20 select-none touch-none ${
                isDesktop() ? 'flex' : 'hidden'
              }`}
              title="Drag vertically to resize code editor and console drawer"
            >
              <div class="h-0.5 w-12 bg-neutral-400 dark:bg-neutral-600 group-hover:bg-black dark:group-hover:bg-white transition-colors" />
            </div>

            {/* Bottom Sub-Pane: Console Tabs & Drawer */}
            <div
              style={{ height: isDesktop() ? `${100 - splitY()}%` : (mobileView() === 'console' ? '100%' : '0%') }}
              class={`flex-col min-h-0 min-w-0 overflow-hidden bg-white dark:bg-black border-t border-neutral-200 dark:border-neutral-800 ${
                isDesktop() || mobileView() === 'console' ? 'flex' : 'hidden'
              }`}
            >
              {/* Tab Selector */}
              <div class="flex items-center gap-1 px-3 py-1 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 text-xs font-medium">
                <button
                  onClick={() => setActiveTab('cases')}
                  class={`px-3 py-1 rounded-none transition ${
                    activeTab() === 'cases'
                      ? 'bg-white dark:bg-black text-neutral-900 dark:text-white font-semibold border border-neutral-300 dark:border-neutral-700'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  Test Cases
                </button>
                <button
                  onClick={() => setActiveTab('output')}
                  class={`px-3 py-1 rounded-none transition ${
                    activeTab() === 'output'
                      ? 'bg-white dark:bg-black text-neutral-900 dark:text-white font-semibold border border-neutral-300 dark:border-neutral-700'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  Run Output
                </button>
                <button
                  onClick={() => setActiveTab('verdict')}
                  class={`px-3 py-1 rounded-none transition ${
                    activeTab() === 'verdict'
                      ? 'bg-white dark:bg-black text-neutral-900 dark:text-white font-semibold border border-neutral-300 dark:border-neutral-700'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  Submissions
                </button>
              </div>

              {/* Tab Content */}
              <div class="flex-1 p-3 sm:p-4 overflow-y-auto min-h-0 text-xs">
                {/* 1. Testcases Tab */}
                <Show when={activeTab() === 'cases'}>
                  <div class="space-y-3 font-sans">
                    <div class="flex items-center gap-2">
                      <For each={problemDetail()?.sample_tests || []}>
                        {(_tc, idx) => (
                          <button
                            onClick={() => {
                              setSelectedCaseIndex(idx());
                              setUseCustomInput(false);
                            }}
                            class={`px-3 py-1 rounded-none text-xs font-semibold border transition ${
                              selectedCaseIndex() === idx() && !useCustomInput()
                                ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
                                : 'bg-white dark:bg-black border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                            }`}
                          >
                            Case {idx() + 1}
                          </button>
                        )}
                      </For>
                      <button
                        onClick={() => setUseCustomInput(true)}
                        class={`px-3 py-1 rounded-none text-xs font-semibold border transition ${
                          useCustomInput()
                            ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
                            : 'bg-white dark:bg-black border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                        }`}
                      >
                        + Custom Input
                      </button>
                    </div>

                    <Show
                      when={useCustomInput()}
                      fallback={
                        <Show when={problemDetail()?.sample_tests?.[selectedCaseIndex()]}>
                          {(tc) => (
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <span class="font-semibold text-neutral-600 dark:text-neutral-400 mb-1 block text-xs font-sans">
                                  Input:
                                </span>
                                <pre class="p-2.5 bg-neutral-50 dark:bg-neutral-950 rounded-none border border-neutral-200 dark:border-neutral-800 font-mono text-xs text-neutral-800 dark:text-neutral-200 max-h-48 overflow-y-auto overflow-x-auto whitespace-pre block">
                                  {tc().input_data}
                                </pre>
                              </div>
                              <div>
                                <span class="font-semibold text-neutral-600 dark:text-neutral-400 mb-1 block text-xs font-sans">
                                  Expected Output:
                                </span>
                                <pre class="p-2.5 bg-neutral-50 dark:bg-neutral-950 rounded-none border border-neutral-200 dark:border-neutral-800 font-mono text-xs text-neutral-800 dark:text-neutral-200 font-bold max-h-48 overflow-y-auto overflow-x-auto whitespace-pre block">
                                  {tc().output_data}
                                </pre>
                              </div>
                            </div>
                          )}
                        </Show>
                      }
                    >
                      <div>
                        <span class="font-semibold text-neutral-700 dark:text-neutral-300 mb-1 block text-xs font-sans">Custom Input:</span>
                        <textarea
                          rows="3"
                          value={customInputText()}
                          onInput={(e) => setCustomInputText(e.currentTarget.value)}
                          placeholder="Enter custom input to execute against..."
                          class="notion-input w-full font-mono text-xs rounded-none"
                        />
                      </div>
                    </Show>
                  </div>
                </Show>

                {/* 2. Run Output Tab */}
                <Show when={activeTab() === 'output'}>
                  <Show when={isRunning()}>
                    <CrtTerminalLoader mode="run" language={language()} />
                  </Show>
                  <Show when={!isRunning()}>
                    <Show
                      when={sampleRunResult()}
                      fallback={
                        <div class="py-8 text-center text-neutral-400 dark:text-neutral-500 font-sans text-xs">
                          Click "Run Code" to compile and execute against sample test vectors.
                        </div>
                      }
                    >
                    <div class="space-y-3 font-sans">
                      <div class="flex items-center gap-3">
                        <span
                          class="status-chip bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
                        >
                          {sampleRunResult().verdict}
                        </span>
                        <span class="text-neutral-600 dark:text-neutral-400 text-xs font-sans">
                          Time: {sampleRunResult().time_ms || 0}ms &bull; Memory: {sampleRunResult().memory_kb || 0}KB
                        </span>
                      </div>

                      <Show when={sampleRunResult().compile_output}>
                        <pre class="p-3 rounded-none bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-mono text-xs">
                          {sampleRunResult().compile_output}
                        </pre>
                      </Show>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <For each={sampleRunResult().sample_results}>
                          {(sr: any) => (
                            <div class="p-3 bg-white dark:bg-black rounded-none border border-neutral-200 dark:border-neutral-800 space-y-1.5 shadow-xs">
                              <div class="flex justify-between font-semibold text-xs">
                                <span class="text-neutral-800 dark:text-neutral-200">Sample {sr.ordinal}</span>
                                <span class="font-bold text-neutral-900 dark:text-neutral-100">
                                  {sr.verdict}
                                </span>
                              </div>
                              <div class="text-[11px] text-neutral-500 dark:text-neutral-400">
                                Output: <code class="text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5 rounded-none border border-neutral-200 dark:border-neutral-800">{sr.actual || '(no output)'}</code>
                              </div>
                              <Show when={sr.verdict !== 'AC'}>
                                <div class="text-[11px] text-neutral-600 dark:text-neutral-400">
                                  Expected: {sr.expected}
                                </div>
                              </Show>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                  </Show>
                </Show>

                {/* 3. Submission Verdict Tab */}
                <Show when={activeTab() === 'verdict'}>
                  <div class="space-y-3 font-sans">
                    <Show when={isSubmitting()}>
                      <CrtTerminalLoader
                        mode="submit"
                        language={language()}
                        testCount={evaluatingTestCount()}
                        totalTests={32}
                      />
                    </Show>

                    <Show when={submissionVerdict()}>
                      {(v) => (
                        <div class="p-4 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 rounded-none space-y-3 shadow-xs">
                          <div class="flex items-center gap-3">
                            <span
                              class="status-chip text-sm bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700"
                            >
                              {v().verdict}
                            </span>
                            <span class="text-xs text-neutral-600 dark:text-neutral-300 font-sans">
                              Time: <strong class="text-neutral-900 dark:text-white">{v().total_time_ms || 0}ms</strong> &bull; Memory:{' '}
                              <strong class="text-neutral-900 dark:text-white">{Math.round((v().peak_memory_kb || 0) / 1024)}MB</strong>
                            </span>
                          </div>

                          <Show when={v().complexity_report}>
                            {(cr) => (
                              <div
                                class="p-3 rounded-none text-xs border bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 border-neutral-200 dark:border-neutral-800"
                              >
                                <div class="font-semibold mb-1">Complexity Analysis ({cr().target_complexity || 'Enforced'})</div>
                                <div>{cr().diagnostic || 'Passes complexity requirements.'}</div>
                              </div>
                            )}
                          </Show>

                          <Show when={v().compile_output}>
                            <pre class="p-2.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-none font-mono text-xs">
                              {v().compile_output}
                            </pre>
                          </Show>
                        </div>
                      )}
                    </Show>
                  </div>
                </Show>
              </div>
            </div>

            {/* Persistent Sticky Bottom Action Bar */}
            <div class="sticky-action-bar min-h-12 py-2 sm:py-0 px-4 sm:px-6 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black text-xs gap-3">
              <div class="hidden sm:flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>Shortcuts:</span>
                <kbd class="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-none font-sans font-semibold text-[10px]">Ctrl+Enter</kbd>
                <span>Run</span>
                <span class="text-neutral-300 dark:text-neutral-700">&bull;</span>
                <kbd class="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-none font-sans font-semibold text-[10px]">Ctrl+Shift+Enter</kbd>
                <span>Submit</span>
              </div>

              <div class="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-end">
                <button
                  onClick={handleRunSamples}
                  disabled={isRunning() || isSubmitting()}
                  class="btn-workstation-secondary rounded-none px-4 py-2 text-xs font-semibold flex items-center gap-1.5 flex-1 sm:flex-none justify-center"
                >
                  <Show when={isRunning()} fallback={<IconPlay class="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />}>
                    <ButtonSpinner class="w-3.5 h-3.5 text-neutral-900 dark:text-neutral-100" />
                  </Show>
                  <span>{isRunning() ? 'Running...' : 'Run Code'}</span>
                </button>

                <button
                  onClick={handleContestSubmit}
                  disabled={isSubmitting() || isRunning()}
                  class="btn-workstation-primary rounded-none px-4 py-2 text-xs font-semibold flex items-center gap-1.5 flex-1 sm:flex-none justify-center"
                >
                  <Show when={isSubmitting()} fallback={<IconCheck class="w-3.5 h-3.5" />}>
                    <ButtonSpinner class="w-3.5 h-3.5 text-white dark:text-black" />
                  </Show>
                  <span>{isSubmitting() ? 'Evaluating...' : 'Submit Solution'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
      </Show>
    </div>
  );
}
