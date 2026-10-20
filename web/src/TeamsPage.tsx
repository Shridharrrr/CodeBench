import { createSignal, createEffect, onMount, For, Show } from 'solid-js';
import {
  IconUsers,
  IconPlus,
  IconX,
  IconCopy,
  IconCheck,
  IconShield,
  IconSearch,
  IconTrash,
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
    if (!confirm(`Are you sure you want to permanently delete team "${teamName}"? All memberships will be removed immediately.`)) return;
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
    <div class="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 px-6 transition-colors duration-150">
      <div class="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-md">
              Team Management
            </span>
            <span class="text-slate-300 dark:text-slate-700">·</span>
            <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Participant Squads</span>
          </div>
          <h1 class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Teams and Rosters</h1>
          <p class="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Organize your squad before the competition begins. Share your unique invite code with teammates to register under one team. If all members leave a team, it is automatically removed.
          </p>
        </div>

        {/* Notifications */}
        <Show when={errorMsg()}>
          <div class="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium flex items-center justify-between">
            <span>{errorMsg()}</span>
            <button onClick={() => setErrorMsg('')} class="p-0.5 text-rose-400 hover:text-rose-700">
              <IconX class="w-3.5 h-3.5" />
            </button>
          </div>
        </Show>
        <Show when={successMsg()}>
          <div class="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium flex items-center justify-between">
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
            <div class="notion-card p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto mb-3">
                <IconUsers class="w-5 h-5" />
              </div>
              <h2 class="text-base font-bold text-slate-900 dark:text-white">Sign In to Manage Your Team</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 max-w-md mx-auto">
                Authentication is required to create a team or join an existing squad for the competition.
              </p>
              <button
                onClick={props.onOpenAuth}
                class="px-5 py-2.5 rounded-md text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white transition shadow-xs"
              >
                Sign In / Register
              </button>
            </div>
          }
        >
          <Show
            when={myTeam()}
            fallback={
              /* Not in a team yet: Show Create or Join Cards */
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Create Team Box */}
                <div class="notion-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div class="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div class="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center">
                      <IconPlus class="w-4 h-4" />
                    </div>
                    <div>
                      <h2 class="text-sm font-bold text-slate-900 dark:text-white">Create a New Team</h2>
                      <p class="text-xs text-slate-500 dark:text-slate-400">You will be designated as the team captain.</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateTeam} class="space-y-4">
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Team Name</label>
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
                      class="w-full py-2.5 rounded-md text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white transition shadow-xs disabled:opacity-50"
                    >
                      {actionLoading() ? 'Creating...' : 'Create Team & Generate Invite Code'}
                    </button>
                  </form>
                </div>

                {/* Join Team Box */}
                <div class="notion-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div class="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                      <IconUsers class="w-4 h-4" />
                    </div>
                    <div>
                      <h2 class="text-sm font-bold text-slate-900 dark:text-white">Join Existing Team</h2>
                      <p class="text-xs text-slate-500 dark:text-slate-400">Enter the 6-character code provided by your captain.</p>
                    </div>
                  </div>

                  <form onSubmit={handleJoinTeam} class="space-y-4">
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Team Invite Code</label>
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
                      class="w-full py-2.5 rounded-md text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition shadow-xs disabled:opacity-50"
                    >
                      {actionLoading() ? 'Joining...' : 'Join Team with Code'}
                    </button>
                  </form>
                </div>
              </div>
            }
          >
            {/* Active Team Roster Card */}
            {(team) => (
              <div class="notion-card p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-850">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase">
                        Active Team
                      </span>
                      <h2 class="text-xl font-bold text-slate-900 dark:text-white">{team().name}</h2>
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Registered for competition · Created {new Date(team().created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Team Join Code & Copy Button */}
                  <div class="flex items-center gap-3">
                    <div class="px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-2">
                      <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Invite Code:</span>
                      <span class="font-mono text-xs font-bold text-slate-900 dark:text-white tracking-wider">
                        {team().join_code}
                      </span>
                      <button
                        onClick={() => copyCode(team().join_code)}
                        class="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-semibold transition flex items-center gap-1"
                      >
                        <Show when={copiedCode()} fallback={<IconCopy class="w-3 h-3" />}>
                          <IconCheck class="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        </Show>
                        <span>{copiedCode() ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <button
                      onClick={handleLeaveTeam}
                      class="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
                    >
                      Leave Team
                    </button>

                    <Show when={props.user?.role === 'admin' || team().captain_id === props.user?.id}>
                      <button
                        onClick={() => handleDeleteTeam(team().id, team().name)}
                        class="px-3 py-1.5 rounded-md text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition flex items-center gap-1"
                      >
                        <IconTrash class="w-3 h-3" />
                        <span>Delete Team</span>
                      </button>
                    </Show>
                  </div>
                </div>

                {/* Team Members List */}
                <div>
                  <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                    Team Members ({team().members?.length || 0})
                  </h3>

                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <For each={team().members}>
                      {(m) => (
                        <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {m.user_name?.charAt(0).toUpperCase()}
                          </div>
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5">
                              <span class="text-xs font-bold text-slate-900 dark:text-white truncate">{m.user_name}</span>
                              <Show when={m.user_id === team().captain_id}>
                                <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                  Captain
                                </span>
                              </Show>
                            </div>
                            <span class="text-[11px] text-slate-500 dark:text-slate-400 truncate block">{m.user_email}</span>
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
              <h2 class="text-lg font-bold text-slate-900 dark:text-white">Registered Teams</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">All registered squads participating in the competition.</p>
            </div>
            <div class="w-full sm:w-64 relative">
              <input
                type="text"
                placeholder="Search team or member..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="notion-input w-full text-xs pr-8"
              />
              <span class="absolute right-2.5 top-2.5 text-slate-400 dark:text-slate-500 pointer-events-none">
                <IconSearch class="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          <Show
            when={!loading() && filteredTeams().length > 0}
            fallback={
              <div class="notion-card p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-2">
                  <IconShield class="w-5 h-5" />
                </div>
                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300">No Teams Registered Yet</h3>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery() ? 'No teams matched your search criteria.' : 'Create a team above to begin competing together.'}
                </p>
              </div>
            }
          >
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <For each={filteredTeams()}>
                {(t) => (
                  <div class="notion-card p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 hover:border-slate-300 dark:hover:border-slate-700 transition">
                    <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{t.name}</h3>
                      <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {t.members?.length || 1} {t.members?.length === 1 ? 'member' : 'members'}
                        </span>
                        <Show when={props.user?.role === 'admin'}>
                          <button
                            onClick={() => handleDeleteTeam(t.id, t.name)}
                            class="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition rounded"
                            title="Delete Team (Admin)"
                          >
                            <IconTrash class="w-3.5 h-3.5" />
                          </button>
                        </Show>
                      </div>
                    </div>

                    <div class="space-y-1.5">
                      <For each={t.members}>
                        {(m) => (
                          <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <span class="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-600"></span>
                            <span class="font-medium text-slate-800 dark:text-slate-200">{m.user_name}</span>
                            <Show when={m.user_id === t.captain_id}>
                              <span class="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase">(Captain)</span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>

                    <div class="pt-2 text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-50 dark:border-slate-800/80 flex items-center justify-between">
                      <span>Joined {new Date(t.created_at).toLocaleDateString()}</span>
                      <Show when={props.user && t.members?.some((m) => m.user_id === props.user?.id)}>
                        <span class="text-emerald-600 dark:text-emerald-400 font-bold">Your Team</span>
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
