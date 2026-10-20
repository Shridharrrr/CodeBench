import { createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import {
  IconUsers,
  IconClock,
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

    // Listen to contest SSE events for authoritative round launch
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

  return (
    <div class="flex-1 flex flex-col items-center justify-center py-12 px-6 max-w-4xl mx-auto w-full text-slate-900 dark:text-slate-100">
      {/* Contest Status Header */}
      <div class="text-center mb-8">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          <span>
            {props.contest.is_paused ? 'Competition Paused by Organizer' : 'Competition Not Started'}
          </span>
        </div>
        <h1 class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{props.contest.title}</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto">
          Problem statements and the code editor will unlock once the round is officially started by the event organizer.
        </p>
      </div>

      {/* Countdown Timer Card */}
      <div class="notion-card w-full p-8 text-center mb-8 shadow-xs">
        <span class="text-xs font-bold uppercase tracking-widest text-slate-400">Scheduled Start</span>
        <div class="font-mono text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight my-4">
          {countdown()}
        </div>
        <div class="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>Scoring: <strong class="text-slate-800 dark:text-slate-200 uppercase">{props.contest.scoring}</strong></span>
          <span class="text-slate-300 dark:text-slate-700">·</span>
          <span>Start (IST): <strong class="text-slate-800 dark:text-slate-200">{new Date(props.contest.starts_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })} IST</strong></span>
          <span class="text-slate-300 dark:text-slate-700">·</span>
          <span>End (IST): <strong class="text-slate-800 dark:text-slate-200">{new Date(props.contest.ends_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })} IST</strong></span>
        </div>
      </div>

      {/* Team Registration */}
      <div class="notion-card w-full p-6 mb-8 dark:bg-slate-900 dark:border-slate-800">
        <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 class="text-base font-bold text-slate-900 dark:text-white">Team Registration</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Compete together with teammates or participate individually.</p>
          </div>

          <Show when={props.user && !myTeam()}>
            <div class="flex items-center gap-2">
              <button
                onClick={() => {
                  setTeamError('');
                  setIsCreateModalOpen(true);
                }}
                class="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs flex items-center gap-1.5"
              >
                <IconPlus class="w-3.5 h-3.5" />
                <span>Create Team</span>
              </button>
              <button
                onClick={() => {
                  setTeamError('');
                  setIsJoinModalOpen(true);
                }}
                class="px-3 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs"
              >
                Join with Code
              </button>
            </div>
          </Show>
        </div>

        <Show
          when={props.user}
          fallback={
            <div class="py-6 text-center">
              <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">Sign in or register an account to form teams and submit code.</p>
              <button
                onClick={props.onOpenAuth}
                class="px-5 py-2 rounded-md text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs"
              >
                Sign In / Register
              </button>
            </div>
          }
        >
          <Show
            when={myTeam()}
            fallback={
              <div class="p-6 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-800 text-center">
                <div class="w-9 h-9 rounded-full bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-300 flex items-center justify-center mx-auto mb-2 border border-slate-200 dark:border-slate-700">
                  <IconUsers class="w-4 h-4" />
                </div>
                <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">You are competing as an Individual</h4>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  If this is a team competition, create a team above or enter your team captain's 6-character code.
                </p>
              </div>
            }
          >
            {(team) => (
              <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-800 gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-slate-900 dark:text-white">{team().name}</span>
                      <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Registered
                      </span>
                    </div>
                    <span class="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {team().members?.length || 1} team members joined
                    </span>
                  </div>

                  <div class="flex items-center gap-2">
                    <span class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Join Code:</span>
                    <span class="font-mono text-xs font-bold bg-white dark:bg-slate-950 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white tracking-wider">
                      {team().join_code}
                    </span>
                    <button
                      onClick={() => copyCode(team().join_code)}
                      class="px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition flex items-center gap-1"
                    >
                      <Show when={copiedCode()} fallback={<IconCopy class="w-3.5 h-3.5" />}>
                        <IconCheck class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </Show>
                      <span>{copiedCode() ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <For each={team().members}>
                    {(m) => (
                      <div class="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                          {m.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <div class="min-w-0 flex-1">
                          <span class="text-xs font-medium text-slate-800 dark:text-slate-100 truncate block">{m.user_name}</span>
                          <Show when={m.user_id === team().captain_id}>
                            <span class="text-[9px] font-semibold text-amber-700 dark:text-amber-400 uppercase">Team Captain</span>
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
      <div class="notion-card w-full p-6 dark:bg-slate-900 dark:border-slate-800">
        <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
          <IconShield class="w-3.5 h-3.5" />
          <span>Round Guidelines & Runtime Quotas</span>
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
          <ul class="space-y-1.5 list-disc list-inside">
            <li>Submissions execute in isolated Linux namespace sandboxes</li>
            <li>Hardware instruction counter enforces deterministic evaluation</li>
            <li>Supported languages: C++23, C23, Python 3.12, Rust 1.85, Go 1.24</li>
          </ul>
          <ul class="space-y-1.5 list-disc list-inside">
            <li>Standard memory quota: 256MB, CPU timeout: 1000ms</li>
            <li>Real-time progression during hidden test evaluation</li>
            <li>Server-authoritative timer synchronization across participants</li>
          </ul>
        </div>
      </div>

      {/* Create Team Modal */}
      <Show when={isCreateModalOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div class="notion-card max-w-sm w-full p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div class="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Create Team</h3>
              <button onClick={() => setIsCreateModalOpen(false)} class="text-slate-400 hover:text-slate-800 dark:hover:text-white">
                <IconX class="w-4 h-4" />
              </button>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">You will be designated as captain and receive a shareable invite code.</p>

            <Show when={teamError()}>
              <div class="p-2.5 mb-4 text-xs bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-md">
                {teamError()}
              </div>
            </Show>

            <form onSubmit={handleCreateTeam} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Team Name</label>
                <input
                  type="text"
                  placeholder="Team Name"
                  value={teamNameInput()}
                  onInput={(e) => setTeamNameInput(e.currentTarget.value)}
                  class="notion-input w-full text-xs"
                  required
                />
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  class="px-4 py-2 rounded-md text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={teamLoading()}
                  class="px-4 py-2 rounded-md text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition disabled:opacity-50"
                >
                  {teamLoading() ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      {/* Join Team Modal */}
      <Show when={isJoinModalOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div class="notion-card max-w-sm w-full p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div class="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 class="text-base font-bold text-slate-900 dark:text-white">Join Team</h3>
              <button onClick={() => setIsJoinModalOpen(false)} class="text-slate-400 hover:text-slate-800 dark:hover:text-white">
                <IconX class="w-4 h-4" />
              </button>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">Enter the 6-character team code provided by your captain.</p>

            <Show when={teamError()}>
              <div class="p-2.5 mb-4 text-xs bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-md">
                {teamError()}
              </div>
            </Show>

            <form onSubmit={handleJoinTeam} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Invite Code</label>
                <input
                  type="text"
                  placeholder="CB-XXXX"
                  value={joinCodeInput()}
                  onInput={(e) => setJoinCodeInput(e.currentTarget.value.toUpperCase())}
                  class="notion-input w-full font-mono text-center text-sm font-bold uppercase tracking-widest"
                  required
                />
              </div>

              <div class="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  class="px-4 py-2 rounded-md text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={teamLoading()}
                  class="px-4 py-2 rounded-md text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition disabled:opacity-50"
                >
                  {teamLoading() ? 'Joining...' : 'Join Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
