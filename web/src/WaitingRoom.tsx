import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import {
  IconUsers,
  IconShield,
  IconCopy,
  IconCheck,
  IconPlus,
  IconX,
  IconClock,
  IconTerminal,
  IconLock,
  IconRefresh,
} from './icons';

interface TeamMember {
  team_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  joined_at: string;
}

interface Team {
  id: string;
  name: string;
  join_code: string;
  captain_id: string;
  members: TeamMember[];
}

interface ContestSummary {
  id: string;
  title: string;
  mode: string;
  starts_at: string;
  ends_at: string;
  scoring: string;
  is_paused?: boolean;
  is_team_contest?: boolean;
  max_team_size?: number;
  user_team?: Team;
}

interface WaitingRoomProps {
  contest: ContestSummary;
  user: { id: string; name: string; email: string; role: string } | null;
  csrfToken: string;
  onOpenAuth: () => void;
  onContestStarted: () => void;
}

export default function WaitingRoom(props: WaitingRoomProps) {
  const [countdown, setCountdown] = createSignal('00:00:00');
  const [timerUnits, setTimerUnits] = createSignal({ h: '00', m: '00', s: '00' });
  const [isAwaitingLaunch, setIsAwaitingLaunch] = createSignal(false);
  const [currentTimeIST, setCurrentTimeIST] = createSignal('');
  const [myTeam, setMyTeam] = createSignal<Team | null>(props.contest.user_team || null);
  const [isCreateModalOpen, setIsCreateModalOpen] = createSignal(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = createSignal(false);
  const [teamNameInput, setTeamNameInput] = createSignal('');
  const [joinCodeInput, setJoinCodeInput] = createSignal('');
  const [teamError, setTeamError] = createSignal('');
  const [teamLoading, setTeamLoading] = createSignal(false);
  const [copiedCode, setCopiedCode] = createSignal(false);
  const [isSyncing, setIsSyncing] = createSignal(false);

  let timerHandle: any = null;
  let pollHandle: any = null;

  onMount(() => {
    fetchMyTeam();
    startCountdown();

    const sse = new EventSource(`/api/contests/${props.contest.id}/events`);
    sse.addEventListener('contest_started', () => {
      props.onContestStarted();
    });
    sse.addEventListener('contest_updated', () => {
      checkServerContestState();
    });
    sse.addEventListener('submission_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'contest_started' || data.detail?.event === 'contest_started') {
          props.onContestStarted();
        }
      } catch {}
    });

    // Fast background sync: checks server state every 2s so questions appear automatically
    pollHandle = setInterval(checkServerContestState, 2000);

    onCleanup(() => {
      clearInterval(timerHandle);
      if (pollHandle) clearInterval(pollHandle);
      sse.close();
    });
  });

  const fetchMyTeam = async () => {
    if (!props.user) return;
    try {
      const res = await fetch('/api/teams/my');
      if (res.ok) {
        const data = await res.json();
        if (data && data.team) {
          setMyTeam(data.team);
        }
      }
    } catch (e) {
      console.error('Failed to fetch team', e);
    }
  };

  const checkServerContestState = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/contests/${props.contest.id}`);
      if (res.ok) {
        const data = await res.json();
        const st = String(data?.state || '').toUpperCase();
        if ((st === 'RUNNING' || st === 'FROZEN') && !data.is_paused) {
          props.onContestStarted();
        }
      }
    } catch {} finally {
      setTimeout(() => setIsSyncing(false), 400);
    }
  };

  const startCountdown = () => {
    const update = () => {
      // Synchronize live IST clock string
      try {
        const nowLocal = new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        setCurrentTimeIST(nowLocal + ' IST');
      } catch {}

      const target = new Date(props.contest.starts_at).getTime();
      const now = Date.now();
      const diff = target - now;

      if (!props.contest.starts_at || isNaN(target) || diff <= 0) {
        setIsAwaitingLaunch(true);
        setCountdown('Awaiting Launch');
        checkServerContestState();
        return;
      }

      setIsAwaitingLaunch(false);
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      const pad = (n: number) => String(n).padStart(2, '0');
      const hStr = pad(h);
      const mStr = pad(m);
      const sStr = pad(s);
      setTimerUnits({ h: hStr, m: mStr, s: sStr });
      setCountdown(`${hStr}:${mStr}:${sStr}`);
    };

    update();
    timerHandle = setInterval(update, 1000);
  };

  const handleCreateTeam = async (e: Event) => {
    e.preventDefault();
    setTeamError('');
    if (!teamNameInput().trim()) return;

    setTeamLoading(true);
    try {
      const res = await fetch('/api/teams/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify({ name: teamNameInput().trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMyTeam(data);
        setIsCreateModalOpen(false);
      } else {
        const err = await res.json();
        setTeamError(err.error || 'Failed to create team');
      }
    } catch (e: any) {
      setTeamError(e.message);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleJoinTeam = async (e: Event) => {
    e.preventDefault();
    setTeamError('');
    if (!joinCodeInput().trim()) return;

    setTeamLoading(true);
    try {
      const res = await fetch('/api/teams/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify({ join_code: joinCodeInput().trim().toUpperCase() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMyTeam(data);
        setIsJoinModalOpen(false);
      } else {
        const err = await res.json();
        setTeamError(err.error || 'Invalid team join code');
      }
    } catch (e: any) {
      setTeamError(e.message);
    } finally {
      setTeamLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatIST = (dateStr: string) => {
    try {
      if (!dateStr) return 'Pending Launch';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr || 'Pending Launch';
      const timeStr = d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).toUpperCase() + ' IST';
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) return timeStr;
      const datePart = d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
      });
      return `${datePart}, ${timeStr}`;
    } catch {
      return dateStr || 'Pending Launch';
    }
  };

  return (
    <div class="flex-1 w-full h-full overflow-y-auto bg-white dark:bg-black">
      <div class="max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6 flex flex-col items-center justify-start text-neutral-900 dark:text-neutral-100 font-sans space-y-6">
        
        {/* Top Status & Telemetry Bar */}
        <div class="w-full flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 text-xs">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 font-semibold text-[11px] uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{props.contest.is_paused ? 'Tournament Paused' : 'Tournament Staged'}</span>
            </span>
            <span class="hidden sm:inline text-neutral-400 dark:text-neutral-600">/</span>
            <span class="hidden sm:inline text-neutral-500 dark:text-neutral-400 font-medium text-[11px]">
              Server Sync: {isSyncing() ? 'Synchronizing...' : 'Live 2s Interval'}
            </span>
          </div>

          <div class="flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
            <Show when={currentTimeIST()}>
              <span class="tabular-nums">IST: <strong class="text-neutral-900 dark:text-white">{currentTimeIST()}</strong></span>
            </Show>
            <span class="text-neutral-300 dark:text-neutral-700">|</span>
            <span>Role: <strong class="text-neutral-900 dark:text-white uppercase">{props.user?.role || 'Guest'}</strong></span>
          </div>
        </div>

        {/* Hero Header Section */}
        <div class="text-center w-full pt-2 pb-2">
          <div class="inline-flex items-center gap-2 mb-3">
            <span class="px-2.5 py-0.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-[11px] uppercase tracking-widest text-neutral-700 dark:text-neutral-300 font-semibold font-sans">
              Official Competition Briefing
            </span>
          </div>

          <h1 class="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-neutral-950 dark:text-white uppercase leading-none">
            {props.contest.title}
          </h1>

          <p class="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-3 max-w-xl mx-auto leading-relaxed font-sans">
            The arena sandbox is staged and awaiting the tournament director's signal. Problems, starter functions, and test evaluation harnesses will decrypt automatically.
          </p>

          {/* Badges Strip */}
          <div class="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs font-sans">
            <span class="px-2.5 py-1 border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 font-semibold text-[11px]">
              Scoring: {props.contest.scoring.toUpperCase()} (+20m Wrong Submission Penalty)
            </span>
            <span class="px-2.5 py-1 border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 font-semibold text-[11px]">
              Format: {props.contest.is_team_contest ? `Squad Competition (Max ${props.contest.max_team_size || 3})` : 'Individual Tournament'}
            </span>
            <span class="px-2.5 py-1 border border-neutral-300 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-200 font-semibold text-[11px]">
              Security: 100% Air-Gapped Linux Kernel
            </span>
          </div>
        </div>

        {/* Centerpiece Launch Console / Countdown Card */}
        <div class="w-full bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 shadow-xs">
          {/* Console Header Bar */}
          <div class="h-10 px-4 sm:px-6 bg-neutral-100 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-neutral-700 dark:text-neutral-300 font-bold uppercase tracking-wider text-[11px]">
              <IconClock class="w-3.5 h-3.5 text-neutral-500" />
              <span>Round Launch Chronometer</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black font-semibold text-[10px] uppercase tracking-wider">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{isAwaitingLaunch() ? 'Awaiting Dispatch' : 'Counting Down'}</span>
              </span>
            </div>
          </div>

          {/* Console Display Body */}
          <div class="p-6 sm:p-10 text-center">
            <Show
              when={isAwaitingLaunch()}
              fallback={
                <div>
                  <span class="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest block mb-4">
                    Time Remaining Until Scheduled Window
                  </span>

                  {/* Segmented Digital Flip Clock */}
                  <div class="flex items-center justify-center gap-3 sm:gap-6 my-2">
                    <div class="flex flex-col items-center">
                      <div class="w-20 sm:w-28 h-20 sm:h-28 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center">
                        <span class="text-4xl sm:text-6xl font-black tracking-tight text-neutral-950 dark:text-white tabular-nums">
                          {timerUnits().h}
                        </span>
                      </div>
                      <span class="text-[10px] sm:text-xs uppercase tracking-widest text-neutral-500 font-bold mt-2.5">
                        Hours
                      </span>
                    </div>

                    <span class="text-3xl sm:text-5xl font-bold text-neutral-400 dark:text-neutral-600 -mt-6">:</span>

                    <div class="flex flex-col items-center">
                      <div class="w-20 sm:w-28 h-20 sm:h-28 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center">
                        <span class="text-4xl sm:text-6xl font-black tracking-tight text-neutral-950 dark:text-white tabular-nums">
                          {timerUnits().m}
                        </span>
                      </div>
                      <span class="text-[10px] sm:text-xs uppercase tracking-widest text-neutral-500 font-bold mt-2.5">
                        Minutes
                      </span>
                    </div>

                    <span class="text-3xl sm:text-5xl font-bold text-neutral-400 dark:text-neutral-600 -mt-6">:</span>

                    <div class="flex flex-col items-center">
                      <div class="w-20 sm:w-28 h-20 sm:h-28 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center">
                        <span class="text-4xl sm:text-6xl font-black tracking-tight text-neutral-950 dark:text-white tabular-nums">
                          {timerUnits().s}
                        </span>
                      </div>
                      <span class="text-[10px] sm:text-xs uppercase tracking-widest text-neutral-500 font-bold mt-2.5">
                        Seconds
                      </span>
                    </div>
                  </div>
                </div>
              }
            >
              {/* Mission-Control Staging Radar Display */}
              <div class="py-4">
                <div class="inline-flex items-center gap-2 px-3 py-1 mb-4 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span class="uppercase tracking-wider">Awaiting Organizer Launch Signal</span>
                </div>

                <h2 class="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-neutral-950 dark:text-white uppercase">
                  Launch Sequence Armed
                </h2>

                <p class="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-2.5 max-w-lg mx-auto leading-relaxed">
                  The scheduled competition window has arrived. As soon as the tournament administrator triggers the round, this page will automatically unlock into the competitive arena.
                </p>

                {/* Interactive Status & Fallback Probe Button */}
                <div class="mt-4 flex items-center justify-center">
                  <button
                    onClick={checkServerContestState}
                    disabled={isSyncing()}
                    class="btn-workstation-secondary px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2 rounded-none"
                    title="Probe server to see if tournament has launched"
                  >
                    <IconRefresh class={`w-3.5 h-3.5 ${isSyncing() ? 'animate-spin' : ''}`} />
                    <span>{isSyncing() ? 'Probing Arena State...' : 'Re-check Arena Status'}</span>
                  </button>
                </div>

                {/* Status indicators */}
                <div class="mt-6 pt-5 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500 font-medium">
                  <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 bg-neutral-900 dark:bg-white" />
                    <span>Real-Time SSE Event Stream Armed</span>
                  </div>
                  <span>&bull;</span>
                  <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 bg-neutral-900 dark:bg-white" />
                    <span>PostgreSQL Worker Pool Ready</span>
                  </div>
                  <span>&bull;</span>
                  <div class="flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 bg-neutral-900 dark:bg-white" />
                    <span>Zero Manual Refresh Needed</span>
                  </div>
                </div>
              </div>
            </Show>
          </div>

          {/* 4-Column Structured Schedule Matrix */}
          <div class="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-neutral-200 dark:divide-neutral-800 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-left">
            <div class="p-3.5 sm:p-4">
              <span class="text-[10px] uppercase font-semibold text-neutral-500 block">Round Start</span>
              <span class="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white block mt-0.5">
                {formatIST(props.contest.starts_at)}
              </span>
            </div>
            <div class="p-3.5 sm:p-4">
              <span class="text-[10px] uppercase font-semibold text-neutral-500 block">Round Conclusion</span>
              <span class="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white block mt-0.5">
                {formatIST(props.contest.ends_at)}
              </span>
            </div>
            <div class="p-3.5 sm:p-4">
              <span class="text-[10px] uppercase font-semibold text-neutral-500 block">Scoring Engine</span>
              <span class="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white uppercase block mt-0.5">
                {props.contest.scoring} (+20m WA)
              </span>
            </div>
            <div class="p-3.5 sm:p-4">
              <span class="text-[10px] uppercase font-semibold text-neutral-500 block">Airlock Status</span>
              <span class="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white block mt-0.5">
                100% Offline Air-Gap
              </span>
            </div>
          </div>
        </div>

        {/* Participant Credentials & Squad Management Card */}
      <div class="w-full p-5 sm:p-6 bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-neutral-200 dark:border-neutral-800 gap-3">
          <div>
            <h2 class="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-2">
              <IconUsers class="w-4 h-4 text-neutral-500" />
              <span>Participant Credential & Squad Roster</span>
            </h2>
            <p class="text-xs text-neutral-500 mt-0.5">
              Verify your tournament participation credentials or join a squad before round lockdown.
            </p>
          </div>

          <Show when={props.contest.is_team_contest && props.user && !myTeam()}>
            <div class="flex items-center gap-2">
              <button
                onClick={() => {
                  setTeamError('');
                  setIsCreateModalOpen(true);
                }}
                class="btn-workstation-primary px-3 py-1.5 rounded-none text-xs font-semibold flex items-center gap-1.5"
              >
                <IconPlus class="w-3.5 h-3.5" />
                <span>Create Squad</span>
              </button>
              <button
                onClick={() => {
                  setTeamError('');
                  setIsJoinModalOpen(true);
                }}
                class="btn-workstation-secondary px-3 py-1.5 rounded-none text-xs font-semibold"
              >
                <span>Join with Code</span>
              </button>
            </div>
          </Show>
        </div>

        <Show
          when={props.user}
          fallback={
            <div class="py-8 text-center">
              <p class="text-xs text-neutral-500 mb-3">Sign in with your participant account to register for this round.</p>
              <button
                onClick={props.onOpenAuth}
                class="btn-workstation-primary px-5 py-2 rounded-none text-xs font-bold"
              >
                Sign In to Participate
              </button>
            </div>
          }
        >
          {/* User Credential Bar */}
          <div class="p-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center text-xs font-bold">
                {props.user?.name?.charAt(0).toUpperCase() || 'P'}
              </div>
              <div>
                <span class="font-bold text-neutral-900 dark:text-white block">{props.user?.name}</span>
                <span class="text-neutral-500 text-[11px] block">{props.user?.email}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-black text-[11px] font-semibold text-neutral-800 dark:text-neutral-200">
                Status: Verified Participant
              </span>
              <button
                onClick={fetchMyTeam}
                class="btn-workstation-secondary px-2.5 py-1 text-[11px] font-medium flex items-center gap-1"
                title="Sync squad state"
              >
                <IconRefresh class="w-3 h-3" />
                <span>Sync</span>
              </button>
            </div>
          </div>

          {/* Squad Roster */}
          <Show
            when={myTeam()}
            fallback={
              <div class="p-5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-center">
                <div class="w-8 h-8 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center mx-auto mb-2 border border-neutral-300 dark:border-neutral-700">
                  <IconUsers class="w-4 h-4" />
                </div>
                <h4 class="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  {props.contest.is_team_contest ? 'Competing as Solo Contestant' : 'Individual Participation Mode'}
                </h4>
                <p class="text-[11px] text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  {props.contest.is_team_contest
                    ? 'Your submissions will be scored individually unless you join or form a squad with teammates.'
                    : 'This competition is structured for individual contestants. All solutions will be judged and ranked independently.'}
                </p>
              </div>
            }
          >
            {(team) => (
              <div class="space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-neutral-900 dark:text-white">{team().name}</span>
                      <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-black dark:bg-white text-white dark:text-black">
                        Registered Squad
                      </span>
                    </div>
                    <span class="text-[11px] text-neutral-500 block mt-0.5">
                      {team().members?.length || 1} of {props.contest.max_team_size || 3} maximum members registered
                    </span>
                  </div>

                  <div class="flex items-center gap-2">
                    <div class="flex items-center gap-2 px-3 py-1 bg-white dark:bg-black border border-neutral-300 dark:border-neutral-700 text-xs">
                      <span class="text-[10px] uppercase font-semibold text-neutral-500">Invite Code:</span>
                      <span class="text-xs font-mono font-bold text-neutral-900 dark:text-white tracking-wider">
                        {team().join_code}
                      </span>
                      <button
                        onClick={() => copyCode(team().join_code)}
                        class="text-[10px] text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white font-semibold transition flex items-center gap-1 ml-1"
                      >
                        <Show when={copiedCode()} fallback={<IconCopy class="w-3 h-3" />}>
                          <IconCheck class="w-3 h-3 text-emerald-500" />
                        </Show>
                        <span>{copiedCode() ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <For each={team().members}>
                    {(m) => (
                      <div class="p-2.5 bg-white dark:bg-black border border-neutral-200 dark:border-neutral-800 flex items-center gap-2.5">
                        <div class="w-6 h-6 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black flex items-center justify-center text-[10px] font-bold">
                          {m.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <div class="min-w-0 flex-1">
                          <span class="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate block">
                            {m.user_name}
                          </span>
                          <Show
                            when={m.user_id === team().captain_id}
                            fallback={
                              <span class="text-[9px] text-neutral-500 uppercase tracking-wider block">Member</span>
                            }
                          >
                            <span class="text-[9px] font-bold text-neutral-900 dark:text-white uppercase tracking-wider block">
                              Captain
                            </span>
                          </Show>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </Show>
        </Show>
      </div>

      {/* Technical Sandbox Protocol (3-Column Bento Grid) */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-xs">
        <div class="p-5 bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 space-y-2">
          <div class="flex items-center gap-2 font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-[11px]">
            <IconTerminal class="w-4 h-4 text-neutral-500" />
            <span>01 Function Signature Model</span>
          </div>
          <p class="text-neutral-500 dark:text-neutral-400 leading-relaxed text-xs">
            Contestants implement designated solution methods. Driver wrappers handle I/O parsing and serialization transparently.
          </p>
        </div>

        <div class="p-5 bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 space-y-2">
          <div class="flex items-center gap-2 font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-[11px]">
            <IconShield class="w-4 h-4 text-neutral-500" />
            <span>02 Zero-WAN Airlock</span>
          </div>
          <p class="text-neutral-500 dark:text-neutral-400 leading-relaxed text-xs">
            Submissions run in isolated Linux namespaces with network egress blocked at the socket level. 256MB memory and 1000ms CPU limits enforced.
          </p>
        </div>

        <div class="p-5 bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 space-y-2">
          <div class="flex items-center gap-2 font-bold text-neutral-900 dark:text-white uppercase tracking-wider text-[11px]">
            <IconClock class="w-4 h-4 text-neutral-500" />
            <span>03 Live Telemetry</span>
          </div>
          <p class="text-neutral-500 dark:text-neutral-400 leading-relaxed text-xs">
            Test evaluations execute across multi-core workers in sub-10ms latency. Live standings stream continuously to the venue scoreboard.
          </p>
        </div>
      </div>

      {/* Create Team Modal */}
      <Show when={isCreateModalOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div class="max-w-sm w-full p-6 bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 shadow-2xl space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Create Squad</h3>
              <button onClick={() => setIsCreateModalOpen(false)} class="text-neutral-400 hover:text-black dark:hover:text-white">
                <IconX class="w-4 h-4" />
              </button>
            </div>
            <p class="text-xs text-neutral-500 leading-relaxed">
              You will be designated as squad captain and receive a unique invite code to share with teammates.
            </p>

            <Show when={teamError()}>
              <div class="p-2.5 text-xs bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-semibold">
                {teamError()}
              </div>
            </Show>

            <form onSubmit={handleCreateTeam} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Squad Name</label>
                <input
                  type="text"
                  placeholder="e.g. Algorithmics"
                  value={teamNameInput()}
                  onInput={(e) => setTeamNameInput(e.currentTarget.value)}
                  class="notion-input w-full text-xs font-medium uppercase rounded-none"
                  required
                />
              </div>

              <div class="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  class="btn-workstation-secondary px-4 py-2 text-xs font-semibold rounded-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={teamLoading()}
                  class="btn-workstation-primary px-4 py-2 text-xs font-bold rounded-none"
                >
                  {teamLoading() ? 'Creating...' : 'Create Squad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Join Team Modal */}
      <Show when={isJoinModalOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div class="max-w-sm w-full p-6 bg-white dark:bg-black border border-neutral-300 dark:border-neutral-800 shadow-2xl space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Join Squad</h3>
              <button onClick={() => setIsJoinModalOpen(false)} class="text-neutral-400 hover:text-black dark:hover:text-white">
                <IconX class="w-4 h-4" />
              </button>
            </div>
            <p class="text-xs text-neutral-500 leading-relaxed">
              Enter the 6-character team invite code provided by your squad captain.
            </p>

            <Show when={teamError()}>
              <div class="p-2.5 text-xs bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-semibold">
                {teamError()}
              </div>
            </Show>

            <form onSubmit={handleJoinTeam} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">Invite Code</label>
                <input
                  type="text"
                  placeholder="CB-XXXX"
                  value={joinCodeInput()}
                  onInput={(e) => setJoinCodeInput(e.currentTarget.value.toUpperCase())}
                  class="notion-input w-full text-center text-sm font-mono font-bold uppercase tracking-widest rounded-none"
                  required
                />
              </div>

              <div class="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  class="btn-workstation-secondary px-4 py-2 text-xs font-semibold rounded-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={teamLoading()}
                  class="btn-workstation-primary px-4 py-2 text-xs font-bold rounded-none"
                >
                  {teamLoading() ? 'Joining...' : 'Join Squad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
      </div>
    </div>
  );
}
