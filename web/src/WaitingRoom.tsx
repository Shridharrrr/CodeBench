import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import {
  IconUsers,
  IconShield,
  IconCopy,
  IconCheck,
  IconPlus,
  IconX,
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
  const [myTeam, setMyTeam] = createSignal<Team | null>(props.contest.user_team || null);
  const [isCreateModalOpen, setIsCreateModalOpen] = createSignal(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = createSignal(false);
  const [teamNameInput, setTeamNameInput] = createSignal('');
  const [joinCodeInput, setJoinCodeInput] = createSignal('');
  const [teamError, setTeamError] = createSignal('');
  const [teamLoading, setTeamLoading] = createSignal(false);
  const [copiedCode, setCopiedCode] = createSignal(false);

  let timerHandle: any = null;

  onMount(() => {
    fetchMyTeam();
    startCountdown();

    const sse = new EventSource(`/api/contests/${props.contest.id}/events`);
    sse.addEventListener('contest_started', () => {
      props.onContestStarted();
    });
    sse.addEventListener('submission_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'contest_started') {
          props.onContestStarted();
        }
      } catch {}
    });

    onCleanup(() => {
      clearInterval(timerHandle);
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
    try {
      const res = await fetch(`/api/contests/${props.contest.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.state === 'RUNNING' && !data.is_paused) {
          props.onContestStarted();
        }
      }
    } catch {}
  };

  const startCountdown = () => {
    const update = () => {
      const target = new Date(props.contest.starts_at).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown('Awaiting Launch...');
        checkServerContestState();
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      const pad = (n: number) => String(n).padStart(2, '0');
      setCountdown(`${pad(h)}:${pad(m)}:${pad(s)}`);
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
      return new Date(dateStr).toLocaleTimeString('en-IN', {
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
    <div class="flex-1 flex flex-col items-center justify-center py-6 sm:py-10 px-4 sm:px-6 max-w-4xl mx-auto w-full text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Contest Status Header */}
      <div class="text-center mb-6">
        <div class="inline-flex items-center gap-2 mb-2 font-mono">
          <span class="status-chip bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800">
            {props.contest.is_paused ? 'Contest Paused' : 'Contest Scheduled'}
          </span>
        </div>
        <h1 class="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {props.contest.title}
        </h1>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-lg mx-auto leading-relaxed">
          The arena and code editor will unlock automatically once the round clock initiates.
        </p>
      </div>

      {/* Countdown Timer Card */}
      <div class="notion-card w-full p-5 sm:p-6 text-center mb-6 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px] shadow-[1px_1px_0px_rgba(0,0,0,0.06)] dark:shadow-[1px_1px_0px_rgba(0,0,0,0.4)]">
        <span class="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          Contest Starts In
        </span>
        <div class="my-3 flex justify-center">
          <div class="digital-clock-box px-4 sm:px-6 py-2 sm:py-2.5">
            <span class="font-mono text-3xl sm:text-4xl md:text-5xl font-black text-zinc-900 dark:text-sky-400 tracking-wider">
              {countdown()}
            </span>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <span>Scoring: <strong class="text-zinc-900 dark:text-zinc-200 uppercase">{props.contest.scoring}</strong></span>
          <span class="text-zinc-300 dark:text-zinc-700">&bull;</span>
          <span>Start: <strong class="text-zinc-900 dark:text-zinc-200">{formatIST(props.contest.starts_at)}</strong></span>
          <span class="text-zinc-300 dark:text-zinc-700">&bull;</span>
          <span>End: <strong class="text-zinc-900 dark:text-zinc-200">{formatIST(props.contest.ends_at)}</strong></span>
        </div>
      </div>

      {/* Team Registration */}
      <div class="notion-card w-full p-5 mb-6 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px] shadow-[1px_1px_0px_rgba(0,0,0,0.05)]">
        <div class="flex items-center justify-between pb-3 mb-3 border-b border-[#d4d6dc] dark:border-[#262a32]">
          <div>
            <h2 class="text-xs font-bold text-zinc-900 dark:text-white">Squad Status & Roster</h2>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 font-sans">Compete in a coordinated squad or participate individually.</p>
          </div>

          <Show when={props.user && !myTeam()}>
            <div class="flex items-center gap-2">
              <button
                onClick={() => {
                  setTeamError('');
                  setIsCreateModalOpen(true);
                }}
                class="btn-workstation btn-workstation-primary text-xs"
              >
                <IconPlus class="w-3.5 h-3.5" />
                <span>Create Squad</span>
              </button>
              <button
                onClick={() => {
                  setTeamError('');
                  setIsJoinModalOpen(true);
                }}
                class="btn-workstation btn-workstation-secondary text-xs"
              >
                <span>Join with Code</span>
              </button>
            </div>
          </Show>
        </div>

        <Show
          when={props.user}
          fallback={
            <div class="py-6 text-center font-sans">
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Sign in to participate in this contest.</p>
              <button
                onClick={props.onOpenAuth}
                class="btn-workstation btn-workstation-primary text-xs"
              >
                Sign In
              </button>
            </div>
          }
        >
          <Show
            when={myTeam()}
            fallback={
              <div class="p-4 bg-[#f8f9fa] dark:bg-[#0c0d10] rounded-[2px] border border-[#d4d6dc] dark:border-[#262a32] text-center font-sans">
                <div class="w-7 h-7 rounded-[2px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto mb-2 border border-zinc-300 dark:border-zinc-700">
                  <IconUsers class="w-3.5 h-3.5" />
                </div>
                <h4 class="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Competing Individually</h4>
                <p class="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                  To compete as a team, create a squad above or enter your captain's invite code.
                </p>
              </div>
            }
          >
            {(team) => (
              <div class="space-y-3 font-sans">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-[#f8f9fa] dark:bg-[#14171d] rounded-[2px] border border-[#d4d6dc] dark:border-[#262a32] gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-zinc-900 dark:text-white">{team().name}</span>
                      <span class="status-chip bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[10px]">
                        Registered
                      </span>
                    </div>
                    <span class="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
                      {team().members?.length || 1} squad members
                    </span>
                  </div>

                  <div class="flex items-center gap-2">
                    <div class="digital-clock-box">
                      <span class="text-[10px] uppercase text-zinc-500">Code:</span>
                      <span class="text-xs font-bold text-zinc-900 dark:text-sky-400 tracking-wider">
                        {team().join_code}
                      </span>
                      <button
                        onClick={() => copyCode(team().join_code)}
                        class="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold transition flex items-center gap-1"
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
                      <div class="p-2 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px] flex items-center gap-2">
                        <div class="w-5 h-5 rounded-[2px] bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center text-[10px] font-bold">
                          {m.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <div class="min-w-0 flex-1">
                          <span class="text-xs font-semibold text-zinc-800 dark:text-zinc-100 truncate block">{m.user_name}</span>
                          <Show when={m.user_id === team().captain_id}>
                            <span class="text-[9px] font-semibold text-amber-600 dark:text-amber-400 uppercase">Captain</span>
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

      {/* Rules & Requirements */}
      <div class="notion-card w-full p-5 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px] shadow-[1px_1px_0px_rgba(0,0,0,0.05)] text-xs">
        <h3 class="font-semibold text-zinc-800 dark:text-zinc-200 mb-2.5 flex items-center gap-2">
          <IconShield class="w-3.5 h-3.5 text-zinc-500" />
          <span>Competition Guidelines & Sandbox Rules</span>
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-zinc-600 dark:text-zinc-400">
          <ul class="space-y-1 list-disc list-inside">
            <li>Automated testcase evaluation in isolated Linux sandboxes</li>
            <li>Supported runtimes: C++23, C23, Python 3.12, Rust 1.85, Go 1.24</li>
            <li>Server-authoritative contest clock with synchronized tournament timing</li>
          </ul>
          <ul class="space-y-1 list-disc list-inside">
            <li>Standard execution limits: 256MB memory quota, 1000ms CPU timeout</li>
            <li>Live standings update dynamically on every accepted solution</li>
            <li>Form squads using the 6-character captain code before the round unlocks</li>
          </ul>
        </div>
      </div>

      {/* Create Team Modal */}
      <Show when={isCreateModalOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div class="notion-card max-w-sm w-full p-5 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px] shadow-xl">
            <div class="flex items-center justify-between pb-2 mb-3 border-b border-[#d4d6dc] dark:border-[#262a32]">
              <h3 class="text-xs font-bold text-zinc-900 dark:text-white">Create Squad</h3>
              <button onClick={() => setIsCreateModalOpen(false)} class="text-zinc-400 hover:text-zinc-800 dark:hover:text-white">
                <IconX class="w-4 h-4" />
              </button>
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-3 font-sans">You will be designated as squad captain and receive an invite code.</p>

            <Show when={teamError()}>
              <div class="p-2 mb-3 text-xs bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-[2px]">
                {teamError()}
              </div>
            </Show>

            <form onSubmit={handleCreateTeam} class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Squad Name</label>
                <input
                  type="text"
                  placeholder="e.g. Algorithmics"
                  value={teamNameInput()}
                  onInput={(e) => setTeamNameInput(e.currentTarget.value)}
                  class="notion-input w-full text-xs font-mono uppercase"
                  required
                />
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  class="btn-workstation btn-workstation-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={teamLoading()}
                  class="btn-workstation btn-workstation-primary text-xs"
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
          <div class="notion-card max-w-sm w-full p-5 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px] shadow-xl">
            <div class="flex items-center justify-between pb-2 mb-3 border-b border-[#d4d6dc] dark:border-[#262a32]">
              <h3 class="text-xs font-bold text-zinc-900 dark:text-white">Join Squad</h3>
              <button onClick={() => setIsJoinModalOpen(false)} class="text-zinc-400 hover:text-zinc-800 dark:hover:text-white">
                <IconX class="w-4 h-4" />
              </button>
            </div>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-3 font-sans">Enter the 6-character team code provided by your captain.</p>

            <Show when={teamError()}>
              <div class="p-2 mb-3 text-xs bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-[2px]">
                {teamError()}
              </div>
            </Show>

            <form onSubmit={handleJoinTeam} class="space-y-3">
              <div>
                <label class="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Invite Code</label>
                <input
                  type="text"
                  placeholder="CB-XXXX"
                  value={joinCodeInput()}
                  onInput={(e) => setJoinCodeInput(e.currentTarget.value.toUpperCase())}
                  class="notion-input w-full font-mono text-center text-xs font-bold uppercase tracking-widest"
                  required
                />
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  class="btn-workstation btn-workstation-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={teamLoading()}
                  class="btn-workstation btn-workstation-primary text-xs"
                >
                  {teamLoading() ? 'Joining...' : 'Join Squad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
