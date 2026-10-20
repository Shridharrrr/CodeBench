import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { getBoilerplate } from './templates';
import WaitingRoom from './WaitingRoom';
import MarkdownView from './MarkdownView';
import CodeEditor from './CodeEditor';
import {
  IconTrophy,
  IconCheck,
  IconCopy,
  IconPlay,
  IconX,
  IconClock,
  IconShield,
} from './icons';

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
  const [submissionStage, setSubmissionStage] = createSignal<string>('IDLE');
  const [evaluatingTestCount, setEvaluatingTestCount] = createSignal<number>(0);

  // Solved Cache
  const [problemStatuses, setProblemStatuses] = createSignal<Record<string, string>>({});

  // Leaderboard Freeze indicator
  const [leaderboard, setLeaderboard] = createSignal<Leaderboard | null>(null);

  // Resizable Panes State (horizontal splitX % for problem statement, vertical splitY % for code editor)
  const [splitX, setSplitX] = createSignal<number>(45);
  const [splitY, setSplitY] = createSignal<number>(60);
  const [isDraggingX, setIsDraggingX] = createSignal<boolean>(false);
  const [isDraggingY, setIsDraggingY] = createSignal<boolean>(false);

  let workspaceRef: HTMLDivElement | undefined;
  let rightPaneRef: HTMLDivElement | undefined;

  const handleStartDragX = (e: MouseEvent) => {
    e.preventDefault();
    setIsDraggingX(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!workspaceRef) return;
      const rect = workspaceRef.getBoundingClientRect();
      const newPercent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setSplitX(Math.max(20, Math.min(80, newPercent)));
    };

    const onMouseUp = () => {
      setIsDraggingX(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleStartDragY = (e: MouseEvent) => {
    e.preventDefault();
    setIsDraggingY(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!rightPaneRef) return;
      const rect = rightPaneRef.getBoundingClientRect();
      const newPercent = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setSplitY(Math.max(20, Math.min(85, newPercent)));
    };

    const onMouseUp = () => {
      setIsDraggingY(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  let countdownInterval: any = null;
  let contestEventSource: EventSource | null = null;

  onMount(() => {
    fetchContests();

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

    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
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
    contestEventSource.addEventListener('contest_started', () => {
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

        if (data.problems && data.problems.length > 0 && !selectedLabel()) {
          setSelectedLabel(data.problems[0].label);
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
    return state === 'RUNNING' && !c.is_paused;
  };

  return (
    <div class="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Show
        when={contests().length > 0 && activeContest()}
        fallback={
          <div class="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950">
            <div class="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-4 shadow-xs">
              <IconClock class="w-8 h-8" />
            </div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Competition Not Started</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
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
          <header class="h-14 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between bg-white dark:bg-slate-900 z-20 shadow-xs">
            <div class="flex items-center gap-4">
              <Show
                when={contests().length > 1}
                fallback={
                  <span class="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                    {activeContest()?.title}
                  </span>
                }
              >
                <select
                  value={selectedContestId()}
                  onChange={(e) => setSelectedContestId(e.currentTarget.value)}
                  class="notion-input font-bold text-sm bg-white dark:bg-slate-900"
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
                  <div class="flex items-center gap-2 text-xs">
                    <span
                      class={`px-2 py-0.5 rounded font-semibold uppercase text-[10px] ${
                        c().state === 'running'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                          : c().state === 'upcoming'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                          : c().state === 'PAUSED'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {c().is_paused ? 'Paused' : c().state}
                    </span>

                    <span class="hidden md:inline text-slate-500 dark:text-slate-400">
                      {c().scoring.toUpperCase()} Scoring &bull; {c().problem_count} Problems
                    </span>
                  </div>
                )}
              </Show>
            </div>

            {/* Central Synced Countdown Clock */}
            <div class="flex items-center gap-3">
              <div class="px-3.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">{timerStatusLabel()}:</span>
                <span
                  class={`font-mono text-sm font-bold tracking-widest ${
                    timeRemainingSec() < 300 && timeRemainingSec() > 0
                      ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {timerText()}
                </span>
              </div>

              <Show when={leaderboard()?.is_frozen}>
                <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
                  Scoreboard Frozen
                </span>
              </Show>
            </div>

            {/* Header Actions - Standings button removed as requested */}
            <div class="flex items-center gap-2">
              <Show
                when={isRegistered()}
                fallback={
                  <button
                    onClick={handleJoinContest}
                    class="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs"
                  >
                    Join Contest
                  </button>
                }
              >
                <span class="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 flex items-center gap-1">
                  <IconCheck class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Registered</span>
                </span>
              </Show>
            </div>
          </header>
        {/* Problem Letter Tabs Banner */}
        <div class="h-11 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center gap-1.5 overflow-x-auto">
          <For each={problems()}>
            {(p) => {
              const isSelected = () => selectedLabel() === p.label;
              const status = () => problemStatuses()[p.label];
              return (
                <button
                  onClick={() => setSelectedLabel(p.label)}
                  class={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                    isSelected()
                      ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-xs font-bold'
                      : 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span
                    class={`w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center ${
                      status() === 'AC'
                        ? 'bg-emerald-500 text-white'
                        : status() === 'WA'
                        ? 'bg-rose-500 text-white'
                        : isSelected()
                        ? 'bg-slate-800 dark:bg-slate-700 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {status() === 'AC' ? '✓' : p.label}
                  </span>
                  <span>{p.title || `Problem ${p.label}`}</span>
                  <span class={`text-[10px] ${isSelected() ? 'text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                    ({p.points}p)
                  </span>
                </button>
              );
            }}
          </For>
        </div>

        {/* Dual Pane Ergonomic Workspace with Resizable Splitters */}
        <div ref={workspaceRef} class="flex-1 flex min-h-0 overflow-hidden relative">
          {/* Left Pane: Independently Scrollable Problem Statement */}
          <div
            style={{ width: `${splitX()}%` }}
            class="border-r border-slate-200 dark:border-slate-800 flex flex-col min-w-0 min-h-0 h-full overflow-y-auto bg-white dark:bg-slate-950 p-6 space-y-6"
          >
            <Show when={problemLoading()}>
              <div class="flex-1 flex items-center justify-center text-slate-400 text-xs">
                <span>Loading problem details...</span>
              </div>
            </Show>

            <Show when={problemError()}>
              <div class="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg text-amber-900 dark:text-amber-300 text-xs">
                <strong>Notice:</strong> {problemError()}
              </div>
            </Show>

            <Show when={!problemLoading() && !problemError() && problemDetail()}>
              {(p) => (
                <div class="space-y-6">
                  {/* Header & Badges */}
                  <div class="pb-4 border-b border-slate-100 dark:border-slate-850 space-y-2">
                    <div class="flex items-center justify-between">
                      <h1 class="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {p().label}. {p().title}
                      </h1>
                      <span
                        class={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                          p().difficulty === 'EASY'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : p().difficulty === 'MEDIUM'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {p().difficulty}
                      </span>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Time Limit: <strong class="text-slate-800 dark:text-slate-200">{p().time_limit_ms}ms</strong></span>
                      <span class="text-slate-300 dark:text-slate-700">·</span>
                      <span>Memory Cap: <strong class="text-slate-800 dark:text-slate-200">{p().memory_mb}MB</strong></span>
                      <span class="text-slate-300 dark:text-slate-700">·</span>
                      <span>Points: <strong class="text-slate-800 dark:text-slate-200">{p().points}</strong></span>
                      <Show when={p().complexity_policy?.time_complexity}>
                        <span class="text-slate-300 dark:text-slate-700">·</span>
                        <span class="text-purple-700 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                          Expected: {p().complexity_policy?.time_complexity}
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* Properly Formatted Problem Statement Body */}
                  <MarkdownView content={p().statement_md} />

                  {/* Sample Testcases with Collapsible Cards */}
                  <div class="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                    <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Sample Test Cases
                    </span>

                    <For each={p().sample_tests}>
                      {(tc) => (
                        <div class="p-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                          <div class="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            <span>Sample #{tc.ordinal}</span>
                          </div>
                          <div class="grid grid-cols-2 gap-3">
                            <div>
                              <div class="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">Input</div>
                              <pre class="bg-white dark:bg-[#070a10] p-2 rounded border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto">
                                {tc.input_data}
                              </pre>
                            </div>
                            <div>
                              <div class="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">Expected Output</div>
                              <pre class="bg-white dark:bg-[#070a10] p-2 rounded border border-slate-200 dark:border-slate-800 text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold overflow-x-auto">
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
            onMouseDown={handleStartDragX}
            class="w-1.5 shrink-0 bg-slate-200 dark:bg-zinc-800 hover:bg-blue-500 dark:hover:bg-blue-500 cursor-col-resize transition-colors flex items-center justify-center group relative z-10 select-none"
            title="Drag horizontally to resize problem description and code editor"
          >
            <div class="w-0.5 h-8 rounded-full bg-slate-400 dark:bg-zinc-600 group-hover:bg-white transition-colors" />
          </div>

          {/* Right Pane: Code Editor & Results Console */}
          <div
            ref={rightPaneRef}
            style={{ width: `${100 - splitX()}%` }}
            class="flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-white dark:bg-slate-950"
          >
            {/* Top Sub-Pane: Code Editor (Bounded & Scrollable) */}
            <div
              style={{ height: `${splitY()}%` }}
              class="flex flex-col min-h-0 min-w-0 overflow-hidden"
            >
              {/* Editor Header Bar */}
              <div class="h-10 shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
                <div class="flex items-center gap-3">
                  <select
                    value={language()}
                    onChange={(e) => handleLanguageChange(e.currentTarget.value)}
                    class="notion-input text-xs font-mono py-1"
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
                    class="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition"
                  >
                    Reset Starter
                  </button>
                </div>

                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Problem: <strong class="text-slate-900 dark:text-slate-100">{selectedLabel()}</strong>
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
              onMouseDown={handleStartDragY}
              class="h-1.5 shrink-0 bg-slate-200 dark:bg-zinc-800 hover:bg-blue-500 dark:hover:bg-blue-500 cursor-row-resize transition-colors flex items-center justify-center group relative z-10 select-none"
              title="Drag vertically to resize code editor and console"
            >
              <div class="h-0.5 w-10 rounded-full bg-slate-400 dark:bg-zinc-600 group-hover:bg-white transition-colors" />
            </div>

            {/* Bottom Sub-Pane: Console Tabs & Drawer */}
            <div
              style={{ height: `${100 - splitY()}%` }}
              class="flex flex-col min-h-0 min-w-0 overflow-hidden bg-slate-50/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800"
            >
              {/* Tab Selector */}
              <div class="flex items-center gap-2 px-4 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900 text-xs">
                <button
                  onClick={() => setActiveTab('cases')}
                  class={`px-2.5 py-1 rounded font-semibold transition ${
                    activeTab() === 'cases'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Testcases
                </button>
                <button
                  onClick={() => setActiveTab('output')}
                  class={`px-2.5 py-1 rounded font-semibold transition ${
                    activeTab() === 'output'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Run Output
                </button>
                <button
                  onClick={() => setActiveTab('verdict')}
                  class={`px-2.5 py-1 rounded font-semibold transition ${
                    activeTab() === 'verdict'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Submission Status
                </button>
              </div>

              {/* Tab Content */}
              <div class="flex-1 p-4 overflow-y-auto text-xs">
                {/* 1. Testcases Tab */}
                <Show when={activeTab() === 'cases'}>
                  <div class="space-y-3">
                    <div class="flex items-center gap-2">
                      <For each={problemDetail()?.sample_tests || []}>
                        {(_tc, idx) => (
                          <button
                            onClick={() => {
                              setSelectedCaseIndex(idx());
                              setUseCustomInput(false);
                            }}
                            class={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                              selectedCaseIndex() === idx() && !useCustomInput()
                                ? 'bg-white dark:bg-slate-800 border-slate-400 dark:border-slate-500 text-slate-900 dark:text-white shadow-xs'
                                : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'
                            }`}
                          >
                            Case {idx() + 1}
                          </button>
                        )}
                      </For>
                      <button
                        onClick={() => setUseCustomInput(true)}
                        class={`px-2.5 py-1 rounded text-xs font-semibold border transition ${
                          useCustomInput()
                            ? 'bg-white dark:bg-slate-800 border-slate-400 dark:border-slate-500 text-slate-900 dark:text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'
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
                            <div class="grid grid-cols-2 gap-3">
                              <div>
                                <span class="font-bold text-slate-600 dark:text-slate-300 mb-1 block uppercase tracking-wider text-[10px]">Input:</span>
                                <pre class="p-2 bg-white dark:bg-[#070a10] rounded border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200">
                                  {tc().input_data}
                                </pre>
                              </div>
                              <div>
                                <span class="font-bold text-slate-600 dark:text-slate-300 mb-1 block uppercase tracking-wider text-[10px]">Expected Output:</span>
                                <pre class="p-2 bg-white dark:bg-[#070a10] rounded border border-slate-200 dark:border-slate-800 font-mono text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                                  {tc().output_data}
                                </pre>
                              </div>
                            </div>
                          )}
                        </Show>
                      }
                    >
                      <div>
                        <span class="font-bold text-slate-700 dark:text-slate-300 mb-1 block">Custom Standard Input:</span>
                        <textarea
                          rows="3"
                          value={customInputText()}
                          onInput={(e) => setCustomInputText(e.currentTarget.value)}
                          placeholder="Enter custom input to execute against..."
                          class="notion-input w-full font-mono text-xs"
                        />
                      </div>
                    </Show>
                  </div>
                </Show>

                {/* 2. Run Output Tab */}
                <Show when={activeTab() === 'output'}>
                  <Show
                    when={sampleRunResult()}
                    fallback={
                      <div class="py-6 text-center text-slate-400 dark:text-slate-500">
                        Click "Run Code" to test against visible sample testcases.
                      </div>
                    }
                  >
                    <div class="space-y-3">
                      <div class="flex items-center gap-3">
                        <span
                          class={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            sampleRunResult().verdict === 'AC'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          }`}
                        >
                          {sampleRunResult().verdict}
                        </span>
                        <span class="text-slate-600 dark:text-slate-400 text-xs">
                          Run completed in {sampleRunResult().time_ms || 0}ms &bull; Peak Mem: {sampleRunResult().memory_kb || 0}KB
                        </span>
                      </div>

                      <Show when={sampleRunResult().compile_output}>
                        <pre class="p-2.5 rounded bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-mono text-xs">
                          {sampleRunResult().compile_output}
                        </pre>
                      </Show>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <For each={sampleRunResult().sample_results}>
                          {(sr: any) => (
                            <div class="p-2.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 space-y-1">
                              <div class="flex justify-between font-semibold">
                                <span class="text-slate-800 dark:text-slate-200">Sample #{sr.ordinal}</span>
                                <span class={sr.verdict === 'AC' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                                  {sr.verdict}
                                </span>
                              </div>
                              <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                Output: <code class="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">{sr.actual || '(no output)'}</code>
                              </div>
                              <Show when={sr.verdict !== 'AC'}>
                                <div class="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
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

                {/* 3. Submission Verdict Tab */}
                <Show when={activeTab() === 'verdict'}>
                  <div class="space-y-3">
                    <Show when={isSubmitting()}>
                      <div class="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-center space-y-2">
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                          <span class="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                          <span>Evaluating Hidden Tests: Case {evaluatingTestCount()}/32...</span>
                        </div>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400">
                          Judging inside isolated Linux sandbox container with memory and instruction counting...
                        </p>
                      </div>
                    </Show>

                    <Show when={submissionVerdict()}>
                      {(v) => (
                        <div class="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
                          <div class="flex items-center gap-3">
                            <span
                              class={`px-3 py-1 rounded-md text-sm font-bold uppercase ${
                                v().verdict === 'AC'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              }`}
                            >
                              {v().verdict}
                            </span>
                            <span class="text-xs text-slate-600 dark:text-slate-300">
                              Time: <strong class="text-slate-900 dark:text-white">{v().total_time_ms || 0}ms</strong> &bull; Memory:{' '}
                              <strong class="text-slate-900 dark:text-white">{Math.round((v().peak_memory_kb || 0) / 1024)}MB</strong>
                            </span>
                          </div>

                          <Show when={v().complexity_report}>
                            {(cr) => (
                              <div
                                class={`p-3 rounded-md text-xs border ${
                                  cr().passed
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                }`}
                              >
                                <div class="font-bold mb-1">Complexity Analysis ({cr().target_complexity || 'Enforced'})</div>
                                <div>{cr().diagnostic || 'Passes time and query complexity bounds.'}</div>
                              </div>
                            )}
                          </Show>

                          <Show when={v().compile_output}>
                            <pre class="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded font-mono text-xs">
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
            <div class="sticky-action-bar h-14 px-6 flex items-center justify-between">
              <div class="text-[11px] text-slate-500 dark:text-slate-400">
                <span>Shortcuts: </span>
                <kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">Ctrl+Enter</kbd>
                <span> to Run, </span>
                <kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded font-mono text-[10px]">Ctrl+Shift+Enter</kbd>
                <span> to Submit</span>
              </div>

              <div class="flex items-center gap-3">
                <button
                  onClick={handleRunSamples}
                  disabled={isRunning() || isSubmitting()}
                  class="px-4 py-2 rounded-md text-xs font-semibold bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <IconPlay class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                  <span>{isRunning() ? 'Running...' : 'Run Code'}</span>
                </button>

                <button
                  onClick={handleContestSubmit}
                  disabled={isSubmitting() || isRunning()}
                  class="px-5 py-2 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs disabled:opacity-50 flex items-center gap-1.5 font-bold"
                >
                  <IconCheck class="w-3.5 h-3.5 text-white" />
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
