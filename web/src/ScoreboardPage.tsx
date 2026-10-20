import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import {
  IconTrophy,
  IconRefresh,
  IconSearch,
} from './icons';

interface ContestSummary {
  id: string;
  title: string;
  mode: string;
  starts_at: string;
  ends_at: string;
  freeze_at?: string;
  scoring: string;
  is_paused?: boolean;
  is_team_contest?: boolean;
  max_team_size?: number;
  state?: string;
}

interface ProblemResult {
  problem_label: string;
  points: number;
  penalty_time: number;
  attempts: number;
  is_solved: boolean;
  solved_at_minute?: number;
}

interface ScoreboardRow {
  rank: number;
  user_id?: string;
  user_name: string;
  team_id?: string;
  team_name?: string;
  solved_count: number;
  total_points: number;
  total_penalty: number;
  adjustment_points?: number;
  adjustment_reason?: string;
  problem_results: Record<string, ProblemResult>;
}

interface ScoreboardData {
  contest_id: string;
  contest_title: string;
  scoring: string;
  is_frozen: boolean;
  server_time: string;
  problem_labels: string[];
  rows: ScoreboardRow[];
}

export default function ScoreboardPage() {
  const [contests, setContests] = createSignal<ContestSummary[]>([]);
  const [selectedContestId, setSelectedContestId] = createSignal<string>('');
  const [scoreboard, setScoreboard] = createSignal<ScoreboardData | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [isRefreshing, setIsRefreshing] = createSignal(false);

  let sseSource: EventSource | null = null;

  onMount(async () => {
    await fetchContests();
  });

  onCleanup(() => {
    if (sseSource) sseSource.close();
  });

  const fetchContests = async () => {
    try {
      const res = await fetch('/api/contests');
      if (res.ok) {
        const data = await res.json();
        setContests(data || []);
        if (data && data.length > 0) {
          const current = data[0];
          setSelectedContestId(current.id);
        }
      }
    } catch (e) {
      console.error('Failed to load contests', e);
    } finally {
      setLoading(false);
    }
  };

  createEffect(() => {
    const cid = selectedContestId();
    if (!cid) {
      setScoreboard(null);
      return;
    }

    fetchScoreboard(cid);

    // Setup live SSE updates for leaderboard
    if (sseSource) sseSource.close();
    sseSource = new EventSource(`/api/contests/${cid}/events`);
    sseSource.addEventListener('leaderboard_update', () => {
      fetchScoreboard(cid, true);
    });
    sseSource.addEventListener('submission_update', () => {
      fetchScoreboard(cid, true);
    });
  });

  const fetchScoreboard = async (cid: string, silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/contests/${cid}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setScoreboard(data);
      }
    } catch (e) {
      console.error('Failed to load scoreboard', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const selectedContest = () => contests().find((c) => c.id === selectedContestId());

  const filteredRows = () => {
    const data = scoreboard();
    if (!data || !data.rows) return [];
    const q = searchQuery().toLowerCase().trim();
    if (!q) return data.rows;
    return data.rows.filter((r) => {
      const name = (r.team_name || r.user_name || '').toLowerCase();
      return name.includes(q);
    });
  };

  const problemColumns = () => {
    const data = scoreboard();
    if (!data || !data.problem_labels) return [];
    return data.problem_labels.sort();
  };

  return (
    <div class="flex-1 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-10 px-6 transition-colors duration-150">
      <div class="max-w-6xl mx-auto space-y-6">
        {/* Top Header & Actions */}
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="px-2.5 py-0.5 text-xs font-semibold bg-slate-900 dark:bg-slate-800 text-white rounded-md border border-slate-700">
                Official Standings
              </span>
              <Show when={selectedContest()}>
                {(c) => (
                  <span
                    class={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                      c().state === 'RUNNING'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : c().state === 'PAUSED'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        : c().state === 'FROZEN'
                        ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {c().is_paused ? 'Paused' : c().state || 'Scheduled'}
                  </span>
                )}
              </Show>
              <Show when={scoreboard()?.is_frozen}>
                <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700">
                  Scoreboard Frozen
                </span>
              </Show>
            </div>
            <h1 class="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {scoreboard()?.contest_title || 'Competition Scoreboard'}
            </h1>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Rankings and Solve Times · Scoring: <strong class="text-slate-800 dark:text-slate-200 uppercase">{selectedContest()?.scoring || 'ICPC'}</strong>
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            {/* Contest Switcher */}
            <Show when={contests().length > 1}>
              <select
                value={selectedContestId()}
                onChange={(e) => setSelectedContestId(e.currentTarget.value)}
                class="notion-input text-xs font-medium"
              >
                <For each={contests()}>
                  {(c) => <option value={c.id}>{c.title}</option>}
                </For>
              </select>
            </Show>

            {/* Refresh Button */}
            <button
              onClick={() => {
                if (selectedContestId()) fetchScoreboard(selectedContestId());
              }}
              disabled={isRefreshing()}
              class="px-3.5 py-2 rounded-md text-xs font-semibold bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 transition shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <IconRefresh class={`w-3.5 h-3.5 text-slate-600 dark:text-slate-300 ${isRefreshing() ? 'animate-spin' : ''}`} />
              <span>{isRefreshing() ? 'Updating...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div class="flex items-center justify-between gap-4">
          <div class="w-full sm:w-72 relative">
            <input
              type="text"
              placeholder="Search team or participant..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="notion-input w-full text-xs pr-8"
            />
            <span class="absolute right-2.5 top-2.5 text-slate-400 dark:text-slate-500 pointer-events-none">
              <IconSearch class="w-3.5 h-3.5" />
            </span>
          </div>

          <div class="text-xs text-slate-500 dark:text-slate-400">
            Showing <strong class="text-slate-900 dark:text-white">{filteredRows().length}</strong> competitors
          </div>
        </div>

        {/* Scoreboard Table Card */}
        <Show
          when={!loading() && scoreboard() && filteredRows().length > 0}
          fallback={
            <div class="notion-card p-16 text-center bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-3">
                <IconTrophy class="w-6 h-6" />
              </div>
              <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">
                {contests().length === 0 ? 'No Competitions Found' : 'No Submissions Judged Yet'}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                {contests().length === 0
                  ? 'An event administrator must configure and launch a competition from the Admin Control Center.'
                  : 'The scoreboard will display live ranks, solve times, and points once participants begin submitting solutions.'}
              </p>
            </div>
          }
        >
          <div class="notion-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50/90 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th class="py-3.5 px-4 w-14 text-center">Rank</th>
                    <th class="py-3.5 px-4 min-w-[200px]">Competitor</th>
                    <th class="py-3.5 px-4 w-20 text-center">Solved</th>
                    <th class="py-3.5 px-4 w-28 text-center">Score / Pen</th>
                    <Show when={scoreboard()?.rows.some((r) => r.adjustment_points && r.adjustment_points !== 0)}>
                      <th class="py-3.5 px-3 w-28 text-center">Adjustments</th>
                    </Show>
                    <For each={problemColumns()}>
                      {(label) => (
                        <th class="py-3.5 px-3 text-center min-w-[65px] font-mono">
                          {label}
                        </th>
                      )}
                    </For>
                  </tr>
                </thead>

                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                  <For each={filteredRows()}>
                    {(row) => (
                      <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        {/* Rank Badge */}
                        <td class="py-3 px-4 text-center">
                          <span
                            class={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                              row.rank === 1
                                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-600 font-extrabold'
                                : row.rank === 2
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 font-extrabold'
                                : row.rank === 3
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700 font-extrabold'
                                : 'text-slate-600 dark:text-slate-400 font-bold'
                            }`}
                          >
                            {row.rank}
                          </span>
                        </td>

                        {/* Competitor / Team Name */}
                        <td class="py-3 px-4">
                          <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-900 dark:text-white text-xs">
                              {row.team_name || row.user_name}
                            </span>
                            <Show when={row.team_name}>
                              <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                Team
                              </span>
                            </Show>
                          </div>
                        </td>

                        {/* Solved Count */}
                        <td class="py-3 px-4 text-center font-bold text-slate-900 dark:text-white">
                          {row.solved_count}
                        </td>

                        {/* Total Penalty / Points */}
                        <td class="py-3 px-4 text-center font-mono text-slate-700 dark:text-slate-300">
                          {selectedContest()?.scoring === 'points'
                            ? `${row.total_points} pts`
                            : `${row.total_penalty}m`}
                        </td>

                        {/* Adjustments Column */}
                        <Show when={scoreboard()?.rows.some((r) => r.adjustment_points && r.adjustment_points !== 0)}>
                          <td class="py-3 px-3 text-center">
                            <Show
                              when={row.adjustment_points && row.adjustment_points !== 0}
                              fallback={<span class="text-slate-300 dark:text-slate-700">-</span>}
                            >
                              <span
                                title={row.adjustment_reason || 'Admin Adjustment'}
                                class={`px-2 py-0.5 rounded text-[10px] font-bold cursor-help ${
                                  (row.adjustment_points || 0) > 0
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                }`}
                              >
                                {(row.adjustment_points || 0) > 0 ? `+${row.adjustment_points}` : row.adjustment_points}
                              </span>
                            </Show>
                          </td>
                        </Show>

                        {/* Problem Results */}
                        <For each={problemColumns()}>
                          {(label) => {
                            const res = row.problem_results?.[label];
                            return (
                              <td class="py-2 px-2 text-center">
                                <Show
                                  when={res}
                                  fallback={<span class="text-slate-300 dark:text-slate-700 text-xs">·</span>}
                                >
                                  <Show
                                    when={res?.is_solved}
                                    fallback={
                                      <Show when={(res?.attempts || 0) > 0}>
                                        <div class="p-1 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/60 font-mono text-[11px]">
                                          -{res?.attempts}
                                        </div>
                                      </Show>
                                    }
                                  >
                                    <div class="p-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 font-mono text-[11px] font-bold">
                                      +{(res?.attempts || 1) > 1 ? res?.attempts : ''}
                                      <span class="block text-[9px] font-normal text-emerald-600 dark:text-emerald-400">
                                        {res?.solved_at_minute || res?.penalty_time || 0}m
                                      </span>
                                    </div>
                                  </Show>
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
        </Show>
      </div>
    </div>
  );
}
