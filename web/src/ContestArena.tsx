import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import { getBoilerplate } from './templates';

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
  state: 'upcoming' | 'running' | 'ended';
  time_remaining_ms: number;
  problem_count: number;
  participant_count: number;
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
  const [activeTab, setActiveTab] = createSignal<'samples' | 'verdict' | 'leaderboard'>('samples');
  const [isRunning, setIsRunning] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [sampleRunResult, setSampleRunResult] = createSignal<any | null>(null);
  const [submissionVerdict, setSubmissionVerdict] = createSignal<any | null>(null);
  const [submissionStage, setSubmissionStage] = createSignal<string>('IDLE');

  // Problem Submission Solved Cache (per label: 'AC' | 'WA' | 'PENDING' | 'NONE')
  const [problemStatuses, setProblemStatuses] = createSignal<Record<string, string>>({});

  // Leaderboard State
  const [leaderboard, setLeaderboard] = createSignal<Leaderboard | null>(null);
  const [leaderboardFilter, setLeaderboardFilter] = createSignal('');
  const [isLeaderboardOpen, setIsLeaderboardOpen] = createSignal(false);

  // Practice Set Generator State (Mode B)
  const [isPracticeModalOpen, setIsPracticeModalOpen] = createSignal(false);
  const [practiceCount, setPracticeCount] = createSignal(3);
  const [practiceDifficulty, setPracticeDifficulty] = createSignal('ANY');
  const [practiceDuration, setPracticeDuration] = createSignal(60);
  const [practiceExcludeSolved, setPracticeExcludeSolved] = createSignal(true);
  const [practiceSelectedTags, setPracticeSelectedTags] = createSignal<string[]>([]);
  const [practiceGenerating, setPracticeGenerating] = createSignal(false);

  const availableTags = [
    'array', 'binary-search', 'two-pointers', 'sliding-window',
    'dp', 'hash-table', 'linked-list', 'stack', 'design', 'graph', 'bfs',
  ];

  const handleGeneratePracticeSet = async () => {
    setPracticeGenerating(true);
    try {
      const res = await fetch('/api/practice/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify({
          count: practiceCount(),
          difficulty: practiceDifficulty(),
          duration_minutes: practiceDuration(),
          exclude_solved: practiceExcludeSolved(),
          tags: practiceSelectedTags(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await fetchContests();
        setSelectedContestId(data.contest_id);
        setIsPracticeModalOpen(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to generate practice set.');
      }
    } catch (e) {
      console.error('Error generating practice set', e);
      alert('Network error generating practice set.');
    } finally {
      setPracticeGenerating(false);
    }
  };

  const toggleTag = (tag: string) => {
    if (practiceSelectedTags().includes(tag)) {
      setPracticeSelectedTags(practiceSelectedTags().filter((t) => t !== tag));
    } else {
      setPracticeSelectedTags([...practiceSelectedTags(), tag]);
    }
  };

  // SSE EventSource ref
  let eventSource: EventSource | null = null;
  let timerInterval: any = null;

  onMount(() => {
    fetchContests();
  });

  onCleanup(() => {
    if (eventSource) eventSource.close();
    if (timerInterval) clearInterval(timerInterval);
  });

  // 1. Fetch Contests list
  const fetchContests = async () => {
    try {
      const res = await fetch('/api/contests');
      if (res.ok) {
        const data: ContestSummary[] = await res.json();
        setContests(data || []);
        if (data && data.length > 0 && !selectedContestId()) {
          // Default to first running contest or first contest
          const running = data.find((c) => c.state === 'running');
          const target = running || data[0];
          setSelectedContestId(target.id);
        }
      }
    } catch (e) {
      console.error('Failed to load contests', e);
    }
  };

  // 2. Load Contest Details whenever selectedContestId changes
  createEffect(() => {
    const id = selectedContestId();
    if (!id) return;

    fetchContestDetails(id);
    fetchLeaderboard(id);
    setupContestSSE(id);
  });

  const fetchContestDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/contests/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveContest(data);
      setIsRegistered(data.is_registered || false);
      setProblems(data.problems || []);

      // Calculate timer offset
      const serverTime = new Date(data.server_time).getTime();
      const localTime = Date.now();
      const offset = serverTime - localTime;

      // Start Countdown
      startCountdown(data, offset);

      // Default to problem A if none selected
      if (data.problems && data.problems.length > 0) {
        const currentSelected = selectedLabel();
        const exists = data.problems.some((p: ContestProblemSummary) => p.label === currentSelected);
        if (!exists) {
          setSelectedLabel(data.problems[0].label);
        }
      }
    } catch (e) {
      console.error('Failed to fetch contest detail', e);
    }
  };

  // 3. Start Synced Countdown Timer
  const startCountdown = (c: ContestSummary, offset: number) => {
    if (timerInterval) clearInterval(timerInterval);

    const tick = () => {
      const nowSynced = Date.now() + offset;
      const startsAt = new Date(c.starts_at).getTime();
      const endsAt = new Date(c.ends_at).getTime();

      if (nowSynced < startsAt) {
        // Upcoming
        setTimerStatusLabel('Starts in');
        const diffMs = Math.max(0, startsAt - nowSynced);
        setTimeRemainingSec(Math.floor(diffMs / 1000));
        setTimerText(formatDuration(diffMs));
      } else if (nowSynced < endsAt) {
        // Running
        setTimerStatusLabel('Ends in');
        const diffMs = Math.max(0, endsAt - nowSynced);
        setTimeRemainingSec(Math.floor(diffMs / 1000));
        setTimerText(formatDuration(diffMs));
      } else {
        // Ended
        setTimerStatusLabel('Contest Ended');
        setTimeRemainingSec(0);
        setTimerText('00:00:00');
      }
    };

    tick();
    timerInterval = setInterval(tick, 1000);
  };

  const formatDuration = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  // 4. Fetch selected problem details
  createEffect(() => {
    const contestId = selectedContestId();
    const label = selectedLabel();
    if (!contestId || !label) return;

    loadContestProblem(contestId, label);
  });

  const loadContestProblem = async (contestId: string, label: string) => {
    setProblemLoading(true);
    setProblemError(null);
    try {
      const res = await fetch(`/api/contests/${contestId}/problems/${label}`);
      if (!res.ok) {
        if (res.status === 403) {
          setProblemError('This problem is quarantined until the contest starts.');
        } else {
          setProblemError('Failed to load contest problem statement.');
        }
        setProblemDetail(null);
        setProblemLoading(false);
        return;
      }
      const data: ContestProblemDetail = await res.json();
      setProblemDetail(data);

      // Load code draft or fallback to boilerplate
      const draftKey = `cb_contest_${contestId}_${label}_${language()}`;
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        setSourceCode(saved);
      } else if (data.slug) {
        setSourceCode(getBoilerplate(data.slug, language()));
      }
    } catch {
      setProblemError('Network error loading contest problem.');
      setProblemDetail(null);
    } finally {
      setProblemLoading(false);
    }
  };

  // 5. Join Contest Handler
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
        headers: {
          'X-CSRF-Token': props.csrfToken,
        },
      });
      if (res.ok) {
        setIsRegistered(true);
        fetchContestDetails(id);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to register for contest.');
      }
    } catch (e) {
      console.error('Error joining contest', e);
    }
  };

  // 6. Real-time Leaderboard SSE stream
  const setupContestSSE = (contestId: string) => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    eventSource = new EventSource(`/api/contests/${contestId}/events`);

    eventSource.addEventListener('submission_update', (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.payload) {
          // Fetch refreshed full standings
          fetchLeaderboard(contestId);
        }
      } catch (err) {
        console.error('Failed to parse contest SSE update', err);
      }
    });

    eventSource.onerror = () => {
      // Reconnection handled automatically by browser EventSource
    };
  };

  // 7. Fetch Leaderboard
  const fetchLeaderboard = async (contestId: string) => {
    try {
      const res = await fetch(`/api/contests/${contestId}/leaderboard`);
      if (res.ok) {
        const data: Leaderboard = await res.json();
        setLeaderboard(data);

        // Update local problem solved cache for current user
        if (props.user && data.rows) {
          const userRow = data.rows.find((r) => r.user_id === props.user?.id);
          if (userRow && userRow.problems) {
            const statuses: Record<string, string> = {};
            for (const [lbl, cell] of Object.entries(userRow.problems)) {
              if (cell.solved) {
                statuses[lbl] = 'AC';
              } else if (cell.is_frozen) {
                statuses[lbl] = 'FROZEN';
              } else if (cell.attempt_count > 0) {
                statuses[lbl] = 'WA';
              }
            }
            setProblemStatuses(statuses);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard', e);
    }
  };

  // 8. Run Sample Test Cases
  const handleRunSamples = async () => {
    const detail = problemDetail();
    if (!detail || !detail.slug) return;

    setIsRunning(true);
    setActiveTab('samples');
    setSampleRunResult(null);

    try {
      const res = await fetch(`/api/problems/${detail.slug}/run`, {
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

  // 9. Submit Official Contest Solution
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

      // Subscribe to individual submission SSE for live progress
      const subSse = new EventSource(`/api/submissions/${subId}/events`);
      subSse.addEventListener('submission_update', (e) => {
        try {
          const evData = JSON.parse(e.data);
          if (evData.status) {
            setSubmissionStage(evData.status);
          }
          if (evData.status === 'DONE') {
            subSse.close();
            setIsSubmitting(false);
            // Fetch final submission verdict
            fetchSubmissionVerdict(subId);
            // Refresh contest leaderboard
            fetchLeaderboard(contestId);
          }
        } catch (err) {
          console.error('Error handling submission SSE', err);
        }
      });

      subSse.onerror = () => {
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

  // Code autosave
  const handleCodeChange = (val: string) => {
    setSourceCode(val);
    const contestId = selectedContestId();
    const label = selectedLabel();
    if (contestId && label) {
      localStorage.setItem(`cb_contest_${contestId}_${label}_${language()}`, val);
    }
  };

  // Reset boilerplate
  const handleResetBoilerplate = () => {
    const detail = problemDetail();
    if (detail && detail.slug) {
      const code = getBoilerplate(detail.slug, language());
      setSourceCode(code);
      handleCodeChange(code);
    }
  };

  const filteredLeaderboardRows = () => {
    const lb = leaderboard();
    if (!lb || !lb.rows) return [];
    const q = leaderboardFilter().trim().toLowerCase();
    if (!q) return lb.rows;
    return lb.rows.filter((r) => r.user_name.toLowerCase().includes(q));
  };

  return (
    <div class="flex-1 flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#0a0e17]">
      {/* 1. Contest Arena Header Bar */}
      <header class="h-14 border-b border-white/10 px-6 flex items-center justify-between bg-slate-950/70 backdrop-blur-md z-20">
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <span class={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
              activeContest()?.mode === 'practice'
                ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
                : 'text-purple-400 bg-purple-500/10 border-purple-500/20'
            }`}>
              {activeContest()?.mode === 'practice' ? 'Mode B' : 'Mode A'}
            </span>
            <select
              value={selectedContestId()}
              onChange={(e) => setSelectedContestId(e.currentTarget.value)}
              class="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-semibold text-white focus:outline-none focus:border-purple-500 transition-colors"
            >
              <For each={contests()}>
                {(c) => (
                  <option value={c.id}>
                    {c.title} ({c.state.toUpperCase()})
                  </option>
                )}
              </For>
            </select>
          </div>

          <Show when={activeContest()}>
            {(c) => (
              <div class="flex items-center space-x-3 text-xs text-slate-300">
                <span class="flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-800/80 border border-white/5">
                  <span
                    class={`w-2 h-2 rounded-full ${
                      c().state === 'running'
                        ? 'bg-emerald-400 animate-pulse'
                        : c().state === 'upcoming'
                        ? 'bg-amber-400'
                        : 'bg-slate-500'
                    }`}
                  />
                  <span class="font-medium uppercase">{c().state}</span>
                </span>
                <span class="hidden md:inline text-slate-400">
                  {c().scoring.toUpperCase()} Scoring &bull; {c().problem_count} Problems &bull;{' '}
                  {c().participant_count} Participants
                </span>
              </div>
            )}
          </Show>
        </div>

        {/* Central Synced Countdown Clock */}
        <div class="flex items-center space-x-3">
          <div class="bg-slate-900/90 border border-white/10 px-4 py-1 rounded-lg flex items-center space-x-2 shadow-inner">
            <span class="text-xs font-medium text-slate-400">{timerStatusLabel()}:</span>
            <span
              class={`font-mono text-base font-bold tracking-widest ${
                timeRemainingSec() < 300 && timeRemainingSec() > 0
                  ? 'text-rose-400 animate-pulse'
                  : 'text-emerald-400'
              }`}
            >
              {timerText()}
            </span>
          </div>

          {/* Scoreboard Freeze Indicator Badge */}
          <Show when={leaderboard()?.is_frozen}>
            <div class="flex items-center space-x-1.5 px-2.5 py-1 bg-cyan-950/60 border border-cyan-500/30 rounded-lg text-cyan-300 text-xs font-semibold">
              <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="30 60" />
              </svg>
              <span>Scoreboard Frozen</span>
            </div>
          </Show>
        </div>

        {/* Header Actions: Leaderboard, Practice Set & Registration */}
        <div class="flex items-center space-x-3">
          <button
            onClick={() => setIsPracticeModalOpen(true)}
            class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-600/20 flex items-center space-x-1.5 transition-all"
          >
            <span>+ Practice Set</span>
          </button>

          <button
            onClick={() => setIsLeaderboardOpen(!isLeaderboardOpen())}
            class={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              isLeaderboardOpen()
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10'
            }`}
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Live Standings</span>
          </button>

          <Show
            when={isRegistered()}
            fallback={
              <button
                onClick={handleJoinContest}
                class="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all"
              >
                Join Contest
              </button>
            }
          >
            <div class="flex items-center space-x-1 px-3 py-1 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-semibold">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Registered</span>
            </div>
          </Show>
        </div>
      </header>

      {/* 2. Problem Letter Navigation Banner (A through J) */}
      <div class="h-12 border-b border-white/10 bg-slate-900/60 px-6 flex items-center space-x-2 overflow-x-auto">
        <For each={problems()}>
          {(p) => {
            const isSelected = () => selectedLabel() === p.label;
            const status = () => problemStatuses()[p.label];
            return (
              <button
                onClick={() => setSelectedLabel(p.label)}
                class={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected()
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/50'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-white/5'
                }`}
              >
                <span
                  class={`w-5 h-5 rounded flex items-center justify-center font-bold text-[11px] ${
                    status() === 'AC'
                      ? 'bg-emerald-500 text-white'
                      : status() === 'WA'
                      ? 'bg-rose-500 text-white'
                      : status() === 'FROZEN'
                      ? 'bg-cyan-500 text-white'
                      : isSelected()
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {status() === 'AC' ? '✓' : p.label}
                </span>
                <span class="font-semibold">{p.title || `Problem ${p.label}`}</span>
                <span class="text-[10px] text-slate-400">({p.points}p)</span>
              </button>
            );
          }}
        </For>
      </div>

      {/* 3. Main Split View: Problem Description vs Editor & Results */}
      <div class="flex-1 flex overflow-hidden">
        {/* Left Pane: Statement & Constraints */}
        <div class="w-1/2 border-r border-white/10 flex flex-col overflow-y-auto bg-slate-950/40 p-6 space-y-6">
          <Show when={problemLoading()}>
            <div class="flex-1 flex items-center justify-center text-slate-400 text-sm">
              <svg class="w-6 h-6 animate-spin mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="30 60" />
              </svg>
              <span>Loading problem details...</span>
            </div>
          </Show>

          <Show when={problemError()}>
            <div class="p-6 bg-amber-950/30 border border-amber-500/30 rounded-xl text-amber-200">
              <div class="flex items-center space-x-2 font-bold text-sm mb-1">
                <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Problem Access Quarantined</span>
              </div>
              <p class="text-xs text-amber-300/80">{problemError()}</p>
            </div>
          </Show>

          <Show when={!problemLoading() && !problemError() && problemDetail()}>
            {(p) => (
              <>
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h1 class="text-2xl font-bold text-white tracking-tight">
                      {p().label}. {p().title}
                    </h1>
                    <span
                      class={`text-xs font-semibold px-2.5 py-1 rounded-md uppercase ${
                        p().difficulty === 'EASY'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : p().difficulty === 'MEDIUM'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {p().difficulty}
                    </span>
                  </div>

                  <div class="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>Time Limit: <strong class="text-slate-200">{p().time_limit_ms} ms</strong></span>
                    <span>&bull;</span>
                    <span>Memory Limit: <strong class="text-slate-200">{p().memory_mb} MB</strong></span>
                    <span>&bull;</span>
                    <span>Checker: <strong class="text-slate-200">{p().checker_type}</strong></span>
                    <Show when={p().complexity_policy?.time_complexity}>
                      <span>&bull;</span>
                      <span class="text-purple-300 font-semibold bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        ⚡ Complexity: <strong>{p().complexity_policy?.time_complexity}</strong>
                        {p().complexity_policy?.space_complexity ? ` / Space: ${p().complexity_policy?.space_complexity}` : ''}
                      </span>
                    </Show>
                  </div>
                </div>

                {/* Problem Statement Body */}
                <div class="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                  {p().statement_md}
                </div>

                {/* Sample Test Cases */}
                <div class="space-y-4 pt-4 border-t border-white/10">
                  <h3 class="text-sm font-bold uppercase tracking-wider text-slate-300">
                    Sample Test Cases
                  </h3>
                  <For each={p().sample_tests}>
                    {(tc) => (
                      <div class="bg-slate-900/80 border border-white/5 rounded-xl p-4 space-y-3">
                        <div class="text-xs font-semibold text-purple-400 uppercase">
                          Sample #{tc.ordinal} ({tc.group_name})
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                          <div>
                            <div class="text-[11px] font-bold text-slate-400 mb-1">Input</div>
                            <pre class="bg-slate-950 p-2.5 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto border border-white/5">
                              {tc.input_data}
                            </pre>
                          </div>
                          <div>
                            <div class="text-[11px] font-bold text-slate-400 mb-1">Expected Output</div>
                            <pre class="bg-slate-950 p-2.5 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto border border-white/5">
                              {tc.output_data}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </>
            )}
          </Show>
        </div>

        {/* Right Pane: Code Editor, Action Bar, Results & Verdict */}
        <div class="w-1/2 flex flex-col bg-[#0d121f]">
          {/* Editor Header Bar */}
          <div class="h-11 border-b border-white/10 px-4 flex items-center justify-between bg-slate-950/60">
            <div class="flex items-center space-x-3">
              <select
                value={language()}
                onChange={(e) => setLanguage(e.currentTarget.value)}
                class="bg-slate-900 border border-white/10 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="cpp23-gcc">C++23 (GCC 14)</option>
                <option value="cpp23-clang">C++23 (Clang 18)</option>
                <option value="c23-gcc">C23 (GCC 14)</option>
                <option value="c23-clang">C23 (Clang 18)</option>
              </select>

              <button
                onClick={handleResetBoilerplate}
                class="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                title="Reset to starter code"
              >
                Reset Starter
              </button>
            </div>

            <div class="text-xs text-slate-400">
              Contest Problem: <strong class="text-purple-400 font-bold">{selectedLabel()}</strong>
            </div>
          </div>

          {/* Code Textarea Editor */}
          <div class="flex-1 relative flex">
            <textarea
              value={sourceCode()}
              onInput={(e) => handleCodeChange(e.currentTarget.value)}
              placeholder="// Write your contest solution here..."
              spellcheck={false}
              class="flex-1 w-full p-4 bg-transparent text-slate-100 font-mono text-xs leading-5 resize-none focus:outline-none selection:bg-purple-600/40"
            />
          </div>

          {/* Action Footer: Run Samples & Submit to Contest */}
          <div class="h-14 border-t border-white/10 px-6 flex items-center justify-between bg-slate-950/80">
            <div class="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('samples')}
                class={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab() === 'samples'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sample Results
              </button>
              <button
                onClick={() => setActiveTab('verdict')}
                class={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab() === 'verdict'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Submission Status
              </button>
            </div>

            <div class="flex items-center space-x-3">
              <button
                onClick={handleRunSamples}
                disabled={isRunning() || isSubmitting()}
                class="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-bold border border-white/10 transition-all flex items-center space-x-2"
              >
                <Show when={isRunning()}>
                  <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="30 60" />
                  </svg>
                </Show>
                <span>Run Samples</span>
              </button>

              <button
                onClick={handleContestSubmit}
                disabled={isSubmitting() || isRunning()}
                class="px-5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-lg shadow-purple-600/20 transition-all flex items-center space-x-2"
              >
                <Show when={isSubmitting()}>
                  <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="30 60" />
                  </svg>
                </Show>
                <span>Submit to Contest</span>
              </button>
            </div>
          </div>

          {/* Lower Output Drawer */}
          <div class="h-44 border-t border-white/10 bg-slate-950/90 p-4 overflow-y-auto">
            <Show when={activeTab() === 'samples'}>
              <Show
                when={sampleRunResult()}
                fallback={
                  <div class="text-xs text-slate-500 italic">
                    Click "Run Samples" to test your solution against visible test cases.
                  </div>
                }
              >
                <div class="space-y-3">
                  <div class="flex items-center space-x-3">
                    <span
                      class={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                        sampleRunResult().verdict === 'AC'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {sampleRunResult().verdict}
                    </span>
                    <span class="text-xs text-slate-400">
                      Sample Run Completed in {sampleRunResult().time_ms || 0} ms
                    </span>
                  </div>

                  <Show when={sampleRunResult().compile_output}>
                    <pre class="bg-rose-950/40 p-2.5 rounded border border-rose-500/20 text-xs font-mono text-rose-200">
                      {sampleRunResult().compile_output}
                    </pre>
                  </Show>

                  <div class="grid grid-cols-2 gap-2">
                    <For each={sampleRunResult().sample_results}>
                      {(sr: any) => (
                        <div class="bg-slate-900 p-2.5 rounded border border-white/5 text-xs">
                          <div class="flex justify-between font-semibold mb-1">
                            <span class="text-slate-300">Sample #{sr.ordinal}</span>
                            <span
                              class={
                                sr.verdict === 'AC' ? 'text-emerald-400' : 'text-rose-400'
                              }
                            >
                              {sr.verdict}
                            </span>
                          </div>
                          <div class="text-[11px] text-slate-400 font-mono">
                            Time: {sr.time_ms}ms &bull; Mem: {sr.memory_kb}KB
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </Show>
            </Show>

            <Show when={activeTab() === 'verdict'}>
              <div class="space-y-3">
                <div class="flex items-center space-x-3">
                  <span class="text-xs font-bold text-slate-400">Pipeline Stage:</span>
                  <span class="text-xs font-mono font-bold uppercase text-purple-400 bg-purple-950/50 px-2 py-0.5 rounded border border-purple-500/20">
                    {submissionStage()}
                  </span>
                </div>

                <Show when={submissionVerdict()}>
                  {(v) => (
                    <div class="space-y-2">
                      <div class="flex items-center space-x-3">
                        <span
                          class={`text-sm font-bold px-3 py-1 rounded-md uppercase ${
                            v().verdict === 'AC'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {v().verdict}
                        </span>
                        <span class="text-xs text-slate-300">
                          Total Time: <strong>{v().total_time_ms || 0} ms</strong> &bull; Peak Mem:{' '}
                          <strong>{v().peak_memory_kb || 0} KB</strong>
                        </span>
                      </div>

                      {/* Complexity Diagnostic Report */}
                      <Show when={v().complexity_report}>
                        {(cr) => (
                          <div
                            class={`p-3 rounded-lg border text-xs space-y-1 ${
                              cr().passed
                                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                            }`}
                          >
                            <div class="flex items-center justify-between font-bold">
                              <span>
                                ⚡ Complexity Analysis: {cr().target_complexity || 'Enforced'}
                              </span>
                              <span
                                class={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  cr().passed
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                                }`}
                              >
                                {cr().passed ? 'Passed Policy' : 'Complexity Breach'}
                              </span>
                            </div>
                            <div class="text-[11px] opacity-90 font-mono">
                              {cr().diagnostic || cr().measured_scaling || 'Conforming to complexity policy.'}
                            </div>
                            <Show when={cr().query_limit > 0}>
                              <div class="text-[10px] text-slate-400">
                                Query Budget: {cr().query_count} / {cr().query_limit} accesses used
                              </div>
                            </Show>
                          </div>
                        )}
                      </Show>

                      <Show when={v().compile_output}>
                        <pre class="bg-rose-950/40 p-2 rounded text-xs font-mono text-rose-300 border border-rose-500/20">
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
      </div>

      {/* 4. Live Leaderboard Modal / Flyout Overlay */}
      <Show when={isLeaderboardOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div class="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div class="p-6 border-b border-white/10 flex items-center justify-between bg-slate-950/50">
              <div class="flex items-center space-x-3">
                <h2 class="text-xl font-bold text-white">Live Contest Standings</h2>
                <Show when={leaderboard()?.is_frozen}>
                  <span class="px-2.5 py-0.5 bg-cyan-950 border border-cyan-500/40 rounded-full text-cyan-300 text-xs font-semibold">
                    Scoreboard Frozen
                  </span>
                </Show>
              </div>

              <div class="flex items-center space-x-4">
                <input
                  type="text"
                  placeholder="Search participant..."
                  value={leaderboardFilter()}
                  onInput={(e) => setLeaderboardFilter(e.currentTarget.value)}
                  class="bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />

                <button
                  onClick={() => setIsLeaderboardOpen(false)}
                  class="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800"
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scoreboard Freeze Alert Banner */}
            <Show when={leaderboard()?.is_frozen}>
              <div class="px-6 py-2.5 bg-cyan-950/40 border-b border-cyan-500/20 flex items-center space-x-3 text-cyan-200 text-xs">
                <svg class="w-4 h-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  The scoreboard has been frozen for the final hour. Submissions submitted during freeze
                  appear as <strong>?</strong> and final rankings will be revealed upon unfreeze.
                </span>
              </div>
            </Show>

            {/* Standings Matrix Table */}
            <div class="flex-1 overflow-y-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-white/10 bg-slate-950/80 text-slate-400 font-semibold sticky top-0 z-10">
                    <th class="py-3 px-4 w-12 text-center">Rank</th>
                    <th class="py-3 px-4">Participant</th>
                    <th class="py-3 px-4 w-16 text-center">Solved</th>
                    <th class="py-3 px-4 w-20 text-center">Penalty</th>
                    <For each={problems()}>
                      {(p) => <th class="py-3 px-2 w-14 text-center">{p.label}</th>}
                    </For>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <For
                    each={filteredLeaderboardRows()}
                    fallback={
                      <tr>
                        <td colspan={4 + problems().length} class="py-8 text-center text-slate-500 italic">
                          No standings recorded yet.
                        </td>
                      </tr>
                    }
                  >
                    {(row) => (
                      <tr
                        class={`hover:bg-slate-800/50 transition-colors ${
                          row.user_id === props.user?.id ? 'bg-purple-950/20 font-semibold' : ''
                        }`}
                      >
                        <td class="py-3 px-4 text-center font-bold text-slate-300">
                          {row.rank}
                        </td>
                        <td class="py-3 px-4 text-slate-200 flex items-center space-x-2">
                          <span>{row.user_name}</span>
                          <Show when={row.user_id === props.user?.id}>
                            <span class="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-bold">
                              YOU
                            </span>
                          </Show>
                        </td>
                        <td class="py-3 px-4 text-center font-bold text-emerald-400">
                          {row.score}
                        </td>
                        <td class="py-3 px-4 text-center font-mono text-slate-400">
                          {row.penalty}m
                        </td>

                        {/* Problem Matrix Cells */}
                        <For each={problems()}>
                          {(p) => {
                            const cell = () => row.problems?.[p.label];
                            return (
                              <td class="py-3 px-2 text-center">
                                <Show
                                  when={cell()}
                                  fallback={<span class="text-slate-600">&bull;</span>}
                                >
                                  {(c) => (
                                    <Show
                                      when={!c().is_frozen}
                                      fallback={
                                        <div class="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-bold text-[11px]" title="Frozen Submission">
                                          ?{c().attempt_count > 0 ? ` (${c().attempt_count})` : ''}
                                        </div>
                                      }
                                    >
                                      <Show
                                        when={c().solved}
                                        fallback={
                                          <Show when={c().attempt_count > 0}>
                                            <div class="px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/20 text-rose-400 font-bold text-[11px]">
                                              -{c().attempt_count}
                                            </div>
                                          </Show>
                                        }
                                      >
                                        <div class="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-bold text-[11px]">
                                          +{c().attempt_count > 1 ? c().attempt_count : ''}
                                          <div class="text-[9px] font-normal text-emerald-400/80">
                                            {c().solved_time_minutes}m
                                          </div>
                                        </div>
                                      </Show>
                                    </Show>
                                  )}
                                </Show>
                              </td>
                            );
                          }}
                        </For>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Show>

      {/* 5. Custom Practice Generator Modal (Mode B) */}
      <Show when={isPracticeModalOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div class="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col space-y-5">
            <div class="flex items-center justify-between border-b border-white/10 pb-4">
              <div class="flex items-center space-x-2">
                <span class="text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                  Mode B
                </span>
                <h2 class="text-lg font-bold text-white">Generate Custom Practice Set</h2>
              </div>
              <button
                onClick={() => setIsPracticeModalOpen(false)}
                class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Problem Count Selector */}
            <div class="space-y-2">
              <div class="flex justify-between text-xs font-semibold text-slate-300">
                <span>Number of Problems</span>
                <span class="text-cyan-400 font-bold">{practiceCount()} Problems</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={practiceCount()}
                onInput={(e) => setPracticeCount(parseInt(e.currentTarget.value))}
                class="w-full accent-cyan-500 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div class="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>

            {/* Difficulty Selector */}
            <div class="space-y-2">
              <label class="text-xs font-semibold text-slate-300">Difficulty Range</label>
              <div class="grid grid-cols-4 gap-2">
                {['ANY', 'EASY', 'MEDIUM', 'HARD'].map((diff) => (
                  <button
                    type="button"
                    onClick={() => setPracticeDifficulty(diff)}
                    class={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      practiceDifficulty() === diff
                        ? 'bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-600/20'
                        : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Selector */}
            <div class="space-y-2">
              <label class="text-xs font-semibold text-slate-300">Practice Timer</label>
              <div class="grid grid-cols-5 gap-1.5">
                {[
                  { label: 'Untimed', val: 0 },
                  { label: '30m', val: 30 },
                  { label: '60m', val: 60 },
                  { label: '90m', val: 90 },
                  { label: '120m', val: 120 },
                ].map((dur) => (
                  <button
                    type="button"
                    onClick={() => setPracticeDuration(dur.val)}
                    class={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      practiceDuration() === dur.val
                        ? 'bg-cyan-600 text-white border-cyan-400'
                        : 'bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700'
                    }`}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Exclude Solved Toggle */}
            <div class="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/5">
              <div>
                <div class="text-xs font-semibold text-slate-200">Exclude Solved Problems</div>
                <div class="text-[11px] text-slate-400">Do not include problems you have already passed</div>
              </div>
              <input
                type="checkbox"
                checked={practiceExcludeSolved()}
                onChange={(e) => setPracticeExcludeSolved(e.currentTarget.checked)}
                class="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
              />
            </div>

            {/* Tags Filter Chips */}
            <div class="space-y-2">
              <label class="text-xs font-semibold text-slate-300">Topic Tags (Optional)</label>
              <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                <For each={availableTags}>
                  {(tag) => {
                    const isSelected = () => practiceSelectedTags().includes(tag);
                    return (
                      <button
                        type="button"
                        onClick={() => toggleTag(tag)}
                        class={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${
                          isSelected()
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-slate-800 text-slate-400 border-white/5 hover:text-slate-200'
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>

            {/* Action Buttons */}
            <div class="pt-2 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsPracticeModalOpen(false)}
                class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGeneratePracticeSet}
                disabled={practiceGenerating()}
                class="px-5 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white shadow-lg shadow-cyan-600/30 flex items-center space-x-2 transition-all"
              >
                <Show when={practiceGenerating()}>
                  <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="30 60" />
                  </svg>
                </Show>
                <span>Generate & Start Practice</span>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
