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
    <div class="flex-1 bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 py-6 sm:py-8 px-4 sm:px-6 font-sans transition-colors duration-150 relative">
      <TopProgressBar active={loading()} />
      <div class="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div class="pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div class="inline-flex items-center gap-2 mb-2">
            <span class="px-2 py-0.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700">
              Team Roster
            </span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Squads & Team Formation
          </h1>
          <p class="text-xs sm:text-sm text-neutral-500 mt-1.5 max-w-2xl leading-relaxed">
            Form your squad before the contest begins. Captains generate a secure 6-character invite code to synchronize team membership.
          </p>
        </div>

        {/* Notifications */}
        <Show when={errorMsg()}>
          <div class="p-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
            <span>{errorMsg()}</span>
            <button onClick={() => setErrorMsg('')} class="p-0.5 text-neutral-400 hover:text-black dark:hover:text-white">
              <IconX class="w-3.5 h-3.5" />
            </button>
          </div>
        </Show>
        <Show when={successMsg()}>
          <div class="p-3 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
            <span>{successMsg()}</span>
            <button onClick={() => setSuccessMsg('')} class="p-0.5 text-neutral-400 hover:text-black dark:hover:text-white">
              <IconX class="w-3.5 h-3.5" />
            </button>
          </div>
        </Show>

        {/* Section 1: User's Team Status */}
        <Show
          when={props.user}
          fallback={
            <div class="p-10 text-center bg-white dark:bg-[#09090b] border border-neutral-300 dark:border-neutral-800">
              <div class="w-10 h-10 bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 flex items-center justify-center mx-auto mb-3 border border-neutral-300 dark:border-neutral-700">
                <IconUsers class="w-5 h-5" />
              </div>
              <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
                Sign in to manage squads
              </h2>
              <p class="text-xs text-neutral-500 mt-1 mb-4 max-w-md mx-auto leading-relaxed">
                Sign in to create a new squad or join an existing team roster for the competition round.
              </p>
              <button
                onClick={props.onOpenAuth}
                class="px-4 py-2 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition border border-black dark:border-white"
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
                <div class="p-6 bg-white dark:bg-[#09090b] border border-neutral-300 dark:border-neutral-800 space-y-4">
                  <div class="flex items-center gap-2.5 pb-3 border-b border-neutral-200 dark:border-neutral-800">
                    <span class="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700">
                      New
                    </span>
                    <div>
                      <h2 class="text-xs font-bold text-neutral-900 dark:text-white">Create a Squad</h2>
                      <p class="text-[11px] text-neutral-500">Designates you as the squad captain.</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateTeam} class="space-y-3">
                    <div>
                      <label class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
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
                      class="w-full py-2.5 text-xs font-medium bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition border border-black dark:border-white flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Show when={actionLoading()}>
                        <ButtonSpinner class="w-3.5 h-3.5 text-white dark:text-black" />
                      </Show>
                      <span>{actionLoading() ? 'Creating Squad...' : 'Create Squad and Get Code'}</span>
                    </button>
                  </form>
                </div>

                {/* Join Team Box */}
                <div class="p-6 bg-white dark:bg-[#09090b] border border-neutral-300 dark:border-neutral-800 space-y-4">
                  <div class="flex items-center gap-2.5 pb-3 border-b border-neutral-200 dark:border-neutral-800">
                    <span class="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700">
                      Join
                    </span>
                    <div>
                      <h2 class="text-xs font-bold text-neutral-900 dark:text-white">Join Existing Squad</h2>
                      <p class="text-[11px] text-neutral-500">Enter the 6-character code from your captain.</p>
                    </div>
                  </div>

                  <form onSubmit={handleJoinTeam} class="space-y-3">
                    <div>
                      <label class="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                        Invite Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={10}
                        value={joinCode()}
                        onInput={(e) => setJoinCode(e.currentTarget.value.toUpperCase())}
                        placeholder="CB-XXXX"
                        class="notion-input w-full text-center uppercase text-xs font-bold tracking-widest"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={actionLoading() || !joinCode().trim()}
                      class="btn-workstation btn-workstation-secondary w-full text-xs flex items-center justify-center gap-2"
                    >
                      <Show when={actionLoading()}>
                        <ButtonSpinner class="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
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
              <div class="p-6 bg-white dark:bg-[#09090b] border border-neutral-300 dark:border-neutral-800 space-y-5">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-neutral-200 dark:border-neutral-800">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700">
                        Active Squad
                      </span>
                      <h2 class="text-lg font-bold text-neutral-900 dark:text-white">{team().name}</h2>
                    </div>
                    <p class="text-xs text-neutral-500 mt-1">
                      Created {new Date(team().created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Team Join Code & Copy Button */}
                  <div class="flex flex-wrap items-center gap-2.5">
                    <div class="inline-flex items-center gap-2 px-3 py-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700">
                      <span class="text-[10px] uppercase font-semibold text-neutral-500">Code:</span>
                      <span class="text-xs font-bold text-neutral-900 dark:text-white tracking-wider">
                        {team().join_code}
                      </span>
                      <button
                        onClick={() => copyCode(team().join_code)}
                        class="text-[10px] text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white font-semibold transition flex items-center gap-1"
                      >
                        <Show when={copiedCode()} fallback={<IconCopy class="w-3 h-3" />}>
                          <IconCheck class="w-3 h-3 text-emerald-500" />
                        </Show>
                        <span>{copiedCode() ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <button
                      onClick={handleLeaveTeam}
                      class="px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition"
                    >
                      Leave Squad
                    </button>

                    <Show when={props.user?.role === 'admin' || team().captain_id === props.user?.id}>
                      <button
                        onClick={() => handleDeleteTeam(team().id, team().name)}
                        class="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-rose-300 dark:border-rose-800 transition flex items-center gap-1.5"
                      >
                        <IconTrash class="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </Show>
                  </div>
                </div>

                {/* Team Members List */}
                <div>
                  <h3 class="text-xs font-semibold tracking-wider text-neutral-600 dark:text-neutral-400 mb-3 uppercase">
                    Squad Members ({team().members?.length || 0})
                  </h3>

                  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    <For each={team().members}>
                      {(m) => (
                        <div class="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center gap-3">
                          <div class="w-8 h-8 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center font-bold text-xs shrink-0">
                            {((m.user_name || (m.user_id === props.user?.id ? props.user?.name : '') || m.user_email || 'M').trim().charAt(0) || 'M').toUpperCase()}
                          </div>
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5">
                              <span class="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                                {m.user_name || (m.user_id === props.user?.id ? props.user?.name : '') || m.user_email || 'Squad Member'}
                              </span>
                              <Show when={m.user_id === team().captain_id}>
                                <span class="px-1.5 py-0.2 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 text-[9px] font-semibold">
                                  Captain
                                </span>
                              </Show>
                            </div>
                            <span class="text-[11px] text-neutral-500 truncate block">
                              {m.user_email || (m.user_id === props.user?.id ? props.user?.email : '')}
                            </span>
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
              <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
                Participating Squads
              </h2>
              <p class="text-xs text-neutral-500">
                All registered participant squads active in the competition.
              </p>
            </div>
            <div class="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="Search squads or members..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                class="notion-input w-full text-xs pr-8 py-2"
              />
              <span class="absolute right-3 top-2.5 text-neutral-400 dark:text-neutral-500 pointer-events-none">
                <IconSearch class="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          <Show when={loading()}>
            <TableSkeletonLoader rows={6} columns={3} />
          </Show>

          <Show when={!loading() && filteredTeams().length === 0}>
            <div class="p-10 text-center bg-white dark:bg-[#09090b] border border-neutral-300 dark:border-neutral-800">
              <div class="w-10 h-10 bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 flex items-center justify-center mx-auto mb-2 border border-neutral-300 dark:border-neutral-700">
                <IconShield class="w-5 h-5" />
              </div>
              <h3 class="text-xs font-semibold text-neutral-900 dark:text-neutral-100">No squads found</h3>
              <p class="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                {searchQuery() ? 'No squads matched your search filter.' : 'Register a squad above to begin competing together.'}
              </p>
            </div>
          </Show>

          <Show when={!loading() && filteredTeams().length > 0}>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <For each={filteredTeams()}>
                {(t) => (
                  <div class="p-4 bg-white dark:bg-[#09090b] border border-neutral-300 dark:border-neutral-800 space-y-2.5 hover:border-neutral-400 dark:hover:border-neutral-600 transition">
                    <div class="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
                      <h3 class="text-xs font-semibold text-neutral-900 dark:text-white truncate max-w-[170px]">{t.name}</h3>
                      <div class="flex items-center gap-1.5">
                        <span class="px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
                          {t.members?.length || 1} member{t.members?.length === 1 ? '' : 's'}
                        </span>
                        <Show when={props.user?.role === 'admin'}>
                          <button
                            onClick={() => handleDeleteTeam(t.id, t.name)}
                            class="p-1 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
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
                          <div class="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                            <span class="w-1.5 h-1.5 bg-neutral-400 dark:bg-neutral-600 shrink-0" />
                            <span class="font-medium text-neutral-900 dark:text-neutral-100 truncate">{m.user_name}</span>
                            <Show when={m.user_id === t.captain_id}>
                              <span class="text-[9px] text-neutral-500 font-bold uppercase">(Captain)</span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>

                    <div class="pt-2 text-[10px] text-neutral-500 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                      <span>Created {new Date(t.created_at).toLocaleDateString()}</span>
                      <Show when={props.user && t.members?.some((m) => m.user_id === props.user?.id)}>
                        <span class="text-emerald-700 dark:text-emerald-400 font-bold">Your squad</span>
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
