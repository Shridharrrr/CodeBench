import { createSignal, createEffect, onMount, For, Show } from 'solid-js';
import {
  IconUsers,
  IconX,
  IconCopy,
  IconCheck,
  IconShield,
  IconSearch,
  IconTrash,
} from './icons';
import {
  TableSkeletonLoader,
  ButtonSpinner,
  TopProgressBar,
} from './Loaders';

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
  created_at: string;
}

interface TeamsPageProps {
  user: { id: string; name: string; email: string; role: string } | null;
  csrfToken: string;
  onOpenAuth: () => void;
}

export default function TeamsPage(props: TeamsPageProps) {
  const [myTeam, setMyTeam] = createSignal<Team | null>(null);
  const [allTeams, setAllTeams] = createSignal<Team[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [searchQuery, setSearchQuery] = createSignal('');
  
  // Team creation & joining forms
  const [createName, setCreateName] = createSignal('');
  const [joinCode, setJoinCode] = createSignal('');
  const [errorMsg, setErrorMsg] = createSignal('');
  const [successMsg, setSuccessMsg] = createSignal('');
  const [actionLoading, setActionLoading] = createSignal(false);
  const [copiedCode, setCopiedCode] = createSignal(false);

  onMount(() => {
    loadData();
  });

  createEffect(() => {
    if (props.user) {
      fetchMyTeam();
    } else {
      setMyTeam(null);
    }
  });

  const loadData = async () => {
    setLoading(true);
    await Promise.all([fetchMyTeam(), fetchAllTeams()]);
    setLoading(false);
  };

  const fetchMyTeam = async () => {
    if (!props.user) {
      setMyTeam(null);
      return;
    }
    try {
      const res = await fetch('/api/teams/my');
      if (res.ok) {
        const data = await res.json();
        setMyTeam(data?.team || null);
      }
    } catch (e) {
      console.error('Failed to fetch my team', e);
    }
  };

  const fetchAllTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      if (res.ok) {
        const data = await res.json();
        setAllTeams(data || []);
      }
    } catch (e) {
      console.error('Failed to list teams', e);
    }
  };

  const handleCreateTeam = async (e: Event) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const name = createName().trim();
    if (!name) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/teams/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        const team = await res.json();
        setMyTeam(team);
        setCreateName('');
        setSuccessMsg(`Team "${team.name}" created. Share code: ${team.join_code}`);
        fetchAllTeams();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to create team');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinTeam = async (e: Event) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const code = joinCode().trim().toUpperCase();
    if (!code) return;

    setActionLoading(true);
    try {
      const res = await fetch('/api/teams/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify({ join_code: code }),
      });

      if (res.ok) {
        const team = await res.json();
        setMyTeam(team);
        setJoinCode('');
        setSuccessMsg(`Successfully joined "${team.name}".`);
        fetchAllTeams();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to join team');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!confirm('Are you sure you want to leave your team?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/teams/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
      });

      if (res.ok) {
        setMyTeam(null);
        setSuccessMsg('You have left the team.');
        fetchAllTeams();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to leave team');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to permanently delete squad "${teamName}"? All memberships will be removed immediately.`)) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': props.csrfToken,
        },
      });

      if (res.ok) {
        setSuccessMsg(`Team "${teamName}" has been permanently deleted.`);
        if (myTeam()?.id === teamId) {
          setMyTeam(null);
        }
        fetchAllTeams();
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to delete team');
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredTeams = () => {
    const q = searchQuery().toLowerCase().trim();
    if (!q) return allTeams();
    return allTeams().filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.members?.some((m) => m.user_name.toLowerCase().includes(q))
    );
  };

  return (
    <div class="flex-1 bg-[#f4f5f7] dark:bg-[#090a0c] text-zinc-900 dark:text-zinc-100 py-6 sm:py-8 px-4 sm:px-6 font-sans transition-colors duration-100 relative">
      <TopProgressBar active={loading()} />
      <div class="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div class="pb-4 border-b border-[#d4d6dc] dark:border-[#262a32]">
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Squads & Team Rosters
          </h1>
          <p class="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Form your squad before the contest begins. Captains generate a secure 6-character invite code to synchronize team membership.
          </p>
        </div>

        {/* Notifications */}
        <Show when={errorMsg()}>
          <div class="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-[2px] text-xs flex items-center justify-between">
            <span>{errorMsg()}</span>
            <button onClick={() => setErrorMsg('')} class="p-0.5 text-rose-400 hover:text-rose-700">
              <IconX class="w-3.5 h-3.5" />
            </button>
          </div>
        </Show>
        <Show when={successMsg()}>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-[2px] text-xs flex items-center justify-between">
            <span>{successMsg()}</span>
            <button onClick={() => setSuccessMsg('')} class="p-0.5 text-emerald-400 hover:text-emerald-700">
              <IconX class="w-3.5 h-3.5" />
            </button>
          </div>
        </Show>

        {/* Section 1: User's Team Status */}
        <Show
          when={props.user}
          fallback={
            <div class="notion-card p-10 text-center bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px] shadow-[1px_1px_0px_rgba(0,0,0,0.06)]">
              <div class="w-8 h-8 rounded-[2px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center mx-auto mb-3 border border-zinc-300 dark:border-zinc-700">
                <IconUsers class="w-4 h-4" />
              </div>
              <h2 class="text-sm font-bold text-zinc-900 dark:text-white">
                Sign in to manage squads
              </h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4 max-w-md mx-auto">
                Sign in to create a new squad or join an existing team roster for the competition round.
              </p>
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
              /* Not in a team yet: Show Create or Join Cards */
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Create Team Box */}
                <div class="notion-card p-5 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px] space-y-4 shadow-[1px_1px_0px_rgba(0,0,0,0.05)]">
                  <div class="flex items-center gap-2.5 pb-2.5 border-b border-[#d4d6dc] dark:border-[#262a32]">
                    <span class="status-chip bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold border-zinc-900 dark:border-zinc-100">
                      New
                    </span>
                    <div>
                      <h2 class="text-xs font-bold text-zinc-900 dark:text-white">Create a Squad</h2>
                      <p class="text-[11px] text-zinc-500 dark:text-zinc-400">Designates you as the squad captain.</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateTeam} class="space-y-3">
                    <div>
                      <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Squad Name
                      </label>
                      <input
                        type="text"
                        required
                        value={createName()}
                        onInput={(e) => setCreateName(e.currentTarget.value)}
                        placeholder="e.g. Algorithmics"
                        class="notion-input w-full text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading() || !createName().trim()}
                      class="btn-workstation btn-workstation-primary w-full text-xs flex items-center justify-center gap-2"
                    >
                      <Show when={actionLoading()}>
                        <ButtonSpinner class="w-3.5 h-3.5 text-white" />
                      </Show>
                      <span>{actionLoading() ? 'Creating Squad...' : 'Create Squad & Get Code'}</span>
                    </button>
                  </form>
                </div>

                {/* Join Team Box */}
                <div class="notion-card p-5 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px] space-y-4 shadow-[1px_1px_0px_rgba(0,0,0,0.05)]">
                  <div class="flex items-center gap-2.5 pb-2.5 border-b border-[#d4d6dc] dark:border-[#262a32]">
                    <span class="status-chip bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700">
                      Join
                    </span>
                    <div>
                      <h2 class="text-xs font-bold text-zinc-900 dark:text-white">Join Existing Squad</h2>
                      <p class="text-[11px] text-zinc-500 dark:text-zinc-400">Enter the 6-character code from your captain.</p>
                    </div>
                  </div>

                  <form onSubmit={handleJoinTeam} class="space-y-3">
                    <div>
                      <label class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Invite Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={10}
                        value={joinCode()}
                        onInput={(e) => setJoinCode(e.currentTarget.value.toUpperCase())}
                        placeholder="CB-XXXX"
                        class="notion-input w-full font-mono tracking-widest text-center uppercase text-xs"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading() || !joinCode().trim()}
                      class="btn-workstation btn-workstation-secondary w-full text-xs flex items-center justify-center gap-2"
                    >
                      <Show when={actionLoading()}>
                        <ButtonSpinner class="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                      </Show>
                      <span>{actionLoading() ? 'Joining...' : 'Join Squad'}</span>
                    </button>
                  </form>
                </div>
              </div>
            }
          >
            {/* Active Team Roster Card */}
            {(team) => (
              <div class="notion-card p-5 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px] space-y-5 shadow-[1px_1px_0px_rgba(0,0,0,0.05)]">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#d4d6dc] dark:border-[#262a32]">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="status-chip bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800">
                        Active Squad
                      </span>
                      <h2 class="text-lg font-bold text-zinc-900 dark:text-white">{team().name}</h2>
                    </div>
                    <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Created {new Date(team().created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Team Join Code & Copy Button */}
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="digital-clock-box">
                      <span class="text-[10px] uppercase text-zinc-500 dark:text-zinc-400">Code:</span>
                      <span class="text-xs font-mono font-bold text-zinc-900 dark:text-sky-400 tracking-wider">
                        {team().join_code}
                      </span>
                      <button
                        onClick={() => copyCode(team().join_code)}
                        class="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-medium transition flex items-center gap-1"
                      >
                        <Show when={copiedCode()} fallback={<IconCopy class="w-3 h-3" />}>
                          <IconCheck class="w-3 h-3 text-emerald-500" />
                        </Show>
                        <span>{copiedCode() ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <button
                      onClick={handleLeaveTeam}
                      class="btn-workstation btn-workstation-secondary text-xs"
                    >
                      Leave Squad
                    </button>

                    <Show when={props.user?.role === 'admin' || team().captain_id === props.user?.id}>
                      <button
                        onClick={() => handleDeleteTeam(team().id, team().name)}
                        class="btn-workstation btn-workstation-danger text-xs"
                      >
                        <IconTrash class="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </Show>
                  </div>
                </div>

                {/* Team Members List */}
                <div>
                  <h3 class="text-xs font-semibold tracking-wider text-zinc-600 dark:text-zinc-400 mb-2.5">
                    Squad Members ({team().members?.length || 0})
                  </h3>

                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    <For each={team().members}>
                      {(m) => (
                        <div class="p-2.5 bg-[#f8f9fa] dark:bg-[#14171d] rounded-[2px] border border-[#d4d6dc] dark:border-[#262a32] flex items-center gap-2.5">
                          <div class="w-7 h-7 rounded-[2px] bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs shrink-0 border border-zinc-700 dark:border-zinc-300">
                            {m.user_name?.charAt(0).toUpperCase()}
                          </div>
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5">
                              <span class="text-xs font-bold text-zinc-900 dark:text-white truncate">{m.user_name}</span>
                              <Show when={m.user_id === team().captain_id}>
                                <span class="status-chip bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 text-[9px] py-0 px-1 font-semibold">
                                  Captain
                                </span>
                              </Show>
                            </div>
                            <span class="text-[10px] text-zinc-500 dark:text-zinc-400 truncate block">{m.user_email}</span>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            )}
          </Show>
        </Show>

        {/* Section 2: Registered Teams Directory */}
        <div class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-bold text-zinc-900 dark:text-white">
                Participating Squads
              </h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">
                All registered participant squads active in the competition.
              </p>
            </div>
            <div class="w-full sm:w-64 relative">
              <input
                type="text"
                placeholder="Search squads or members..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="notion-input w-full text-xs pr-8"
              />
              <span class="absolute right-2.5 top-2.5 text-zinc-400 dark:text-zinc-500 pointer-events-none">
                <IconSearch class="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          <Show when={loading()}>
            <TableSkeletonLoader rows={6} columns={3} />
          </Show>

          <Show when={!loading() && filteredTeams().length === 0}>
            <div class="notion-card p-10 text-center bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px]">
              <div class="w-8 h-8 rounded-[2px] bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center mx-auto mb-2 border border-zinc-300 dark:border-zinc-700">
                <IconShield class="w-4 h-4" />
              </div>
              <h3 class="text-xs font-bold text-zinc-700 dark:text-zinc-300">No squads found</h3>
              <p class="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-sm mx-auto">
                {searchQuery() ? 'No squads matched your search filter.' : 'Register a squad above to begin competing together.'}
              </p>
            </div>
          </Show>

          <Show when={!loading() && filteredTeams().length > 0}>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <For each={filteredTeams()}>
                {(t) => (
                  <div class="notion-card p-4 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px] space-y-2.5 hover:border-zinc-400 dark:hover:border-zinc-600 transition">
                    <div class="flex items-center justify-between pb-2 border-b border-[#d4d6dc] dark:border-[#262a32]">
                      <h3 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[170px]">{t.name}</h3>
                      <div class="flex items-center gap-1.5">
                        <span class="status-chip bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 text-[10px]">
                          {t.members?.length || 1} member{t.members?.length === 1 ? '' : 's'}
                        </span>
                        <Show when={props.user?.role === 'admin'}>
                          <button
                            onClick={() => handleDeleteTeam(t.id, t.name)}
                            class="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                            title="Delete Squad"
                          >
                            <IconTrash class="w-3.5 h-3.5" />
                          </button>
                        </Show>
                      </div>
                    </div>

                    <div class="space-y-1">
                      <For each={t.members}>
                        {(m) => (
                          <div class="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                            <span class="w-1.5 h-1.5 bg-zinc-400 dark:bg-zinc-600 inline-block" />
                            <span class="font-medium text-zinc-800 dark:text-zinc-200">{m.user_name}</span>
                            <Show when={m.user_id === t.captain_id}>
                              <span class="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase">(Captain)</span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>

                    <div class="pt-2 text-[10px] text-zinc-400 dark:text-zinc-500 border-t border-[#d4d6dc] dark:border-[#262a32] flex items-center justify-between">
                      <span>Created {new Date(t.created_at).toLocaleDateString()}</span>
                      <Show when={props.user && t.members?.some((m) => m.user_id === props.user?.id)}>
                        <span class="text-emerald-600 dark:text-emerald-400 font-bold">Your squad</span>
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
