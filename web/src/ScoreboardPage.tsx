import { createSignal, createEffect, onMount, onCleanup, For, Show } from 'solid-js';
import {
  IconTrophy,
  IconRefresh,
  IconSearch,
} from './icons';
import {
  TableSkeletonLoader,
  TopProgressBar,
  ButtonSpinner,
} from './Loaders';

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
    <div class="flex-1 bg-white dark:bg-black text-neutral-900 dark:text-neutral-100 py-6 sm:py-8 px-4 sm:px-6 font-sans transition-colors duration-150 relative">
      <TopProgressBar active={isRefreshing()} />
      <div class="max-w-5xl mx-auto space-y-6">
        {/* Top Header & Actions */}
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="px-2 py-0.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700">
                Leaderboard
              </span>
              <Show when={selectedContest()}>
                {(c) => (
                  <span class="px-2 py-0.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700">
                    {c().is_paused ? 'Paused' : (c().state === 'RUNNING' ? 'Running' : (c().state === 'FROZEN' ? 'Frozen' : 'Scheduled'))}
                  </span>
                )}
              </Show>
              <Show when={scoreboard()?.is_frozen}>
                <span class="px-2 py-0.5 text-xs font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700">
                  Scoreboard Frozen
                </span>
              </Show>
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
              {scoreboard()?.contest_title || 'Tournament Standings'}
            </h1>
            <p class="text-xs text-neutral-500 mt-1.5 leading-relaxed">
              Standings stream live over Server-Sent Events / Scoring: <strong class="text-neutral-900 dark:text-white font-medium">{selectedContest()?.scoring === 'icpc' ? 'Standard Penalty' : (selectedContest()?.scoring || 'Standard')}</strong> / Asia/Kolkata (IST)
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            {/* Contest Switcher */}
            <Show when={contests().length > 1}>
              <select
                value={selectedContestId()}
                onChange={(e) => setSelectedContestId(e.currentTarget.value)}
                class="notion-input font-medium text-xs py-1.5 border-neutral-300 dark:border-neutral-700"
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
              class="px-3.5 py-1.5 text-xs font-medium bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 transition flex items-center gap-1.5"
            >
              <Show when={isRefreshing()} fallback={<IconRefresh class="w-3.5 h-3.5 text-neutral-500" />}>
                <ButtonSpinner class="w-3.5 h-3.5 text-black dark:text-white" />
              </Show>
              <span>{isRefreshing() ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div class="w-full sm:w-80 relative">
            <input
              type="text"
              placeholder="Filter competitor or squad..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="notion-input w-full text-xs pr-8 py-2"
            />
            <span class="absolute right-3 top-2.5 text-neutral-400 dark:text-neutral-500 pointer-events-none">
              <IconSearch class="w-3.5 h-3.5" />
            </span>
          </div>

          <div class="text-neutral-500 text-xs font-medium">
            Ranked Participants: <strong class="text-neutral-900 dark:text-white font-semibold">{filteredRows().length}</strong>
          </div>
        </div>

        {/* Scoreboard Table Card */}
        <Show when={loading()}>
          <TableSkeletonLoader rows={8} columns={problemColumns().length + 4} />
        </Show>

        <Show when={!loading() && (!scoreboard() || filteredRows().length === 0)}>
          <div class="p-12 text-center bg-white dark:bg-[#09090b] border border-neutral-300 dark:border-neutral-800">
            <div class="w-10 h-10 bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 flex items-center justify-center mx-auto mb-3 border border-neutral-300 dark:border-neutral-700">
              <IconTrophy class="w-5 h-5" />
            </div>
            <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {contests().length === 0 ? 'No competitions registered' : 'No submissions judged yet'}
            </h3>
            <p class="text-xs text-neutral-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {contests().length === 0
                ? 'An administrator can configure and launch a competition from the Admin Dashboard.'
                : 'The scoreboard will reflect live solve times, points, and penalty logs once participants begin submitting.'}
            </p>
          </div>
        </Show>

        <Show when={!loading() && scoreboard() && filteredRows().length > 0}>
          <div class="bg-white dark:bg-[#09090b] border border-neutral-300 dark:border-neutral-800 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 font-semibold text-[11px] uppercase tracking-wider">
                  <tr>
                    <th class="py-3 px-3 w-16 text-center border-r border-neutral-200 dark:border-neutral-800">Rank</th>
                    <th class="py-3 px-4 min-w-[200px] border-r border-neutral-200 dark:border-neutral-800">Competitor / Squad</th>
                    <th class="py-3 px-3 w-20 text-center border-r border-neutral-200 dark:border-neutral-800">Solved</th>
                    <th class="py-3 px-3 w-28 text-center border-r border-neutral-200 dark:border-neutral-800">Score / Pen</th>
                    <Show when={scoreboard()?.rows.some((r) => r.adjustment_points && r.adjustment_points !== 0)}>
                      <th class="py-3 px-3 w-24 text-center border-r border-neutral-200 dark:border-neutral-800">Adjust</th>
                    </Show>
                    <For each={problemColumns()}>
                      {(label) => (
                        <th class="py-3 px-3 text-center min-w-[65px] font-bold border-r border-neutral-200 dark:border-neutral-800 last:border-r-0">
                          {label}
                        </th>
                      )}
                    </For>
                  </tr>
                </thead>

                <tbody class="divide-y divide-neutral-200 dark:divide-neutral-800 font-sans">
                  <For each={filteredRows()}>
                    {(row) => (
                      <tr class="hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition">
                        {/* Rank Badge */}
                        <td class="py-3 px-3 text-center border-r border-neutral-200 dark:border-neutral-800 font-bold">
                          <span class="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700">
                            #{row.rank}
                          </span>
                        </td>

                        {/* Competitor / Team Name */}
                        <td class="py-3 px-4 border-r border-neutral-200 dark:border-neutral-800">
                          <div class="flex items-center gap-2">
                            <span class="font-semibold text-neutral-900 dark:text-white text-xs">
                              {row.team_name || row.user_name}
                            </span>
                            <Show when={row.team_name}>
                              <span class="px-1.5 py-0.5 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-700">
                                Squad
                              </span>
                            </Show>
                          </div>
                        </td>

                        {/* Solved Count */}
                        <td class="py-3 px-3 text-center font-bold text-sm text-neutral-950 dark:text-white border-r border-neutral-200 dark:border-neutral-800">
                          {row.solved_count}
                        </td>

                        {/* Total Penalty / Points */}
                        <td class="py-3 px-3 text-center font-medium text-neutral-700 dark:text-neutral-300 border-r border-neutral-200 dark:border-neutral-800 tabular-nums">
                          {selectedContest()?.scoring === 'points'
                            ? `${row.total_points} PTS`
                            : `${row.total_penalty}M`}
                        </td>

                        {/* Adjustments Column */}
                        <Show when={scoreboard()?.rows.some((r) => r.adjustment_points && r.adjustment_points !== 0)}>
                          <td class="py-3 px-3 text-center border-r border-neutral-200 dark:border-neutral-800">
                            <Show
                              when={row.adjustment_points && row.adjustment_points !== 0}
                              fallback={<span class="text-neutral-300 dark:text-neutral-700">-</span>}
                            >
                              <span
                                title={row.adjustment_reason || 'Admin Adjustment'}
                                class="px-1.5 py-0.5 text-[10px] font-bold border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900"
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
                              <td class="py-2.5 px-2 text-center border-r border-neutral-200 dark:border-neutral-800 last:border-r-0">
                                <Show
                                  when={res}
                                  fallback={<span class="text-neutral-300 dark:text-neutral-700 text-xs">/</span>}
                                >
                                  <Show
                                    when={res?.is_solved}
                                    fallback={
                                      <Show when={(res?.attempts || 0) > 0}>
                                        <div class="py-1 px-1.5 bg-neutral-100 dark:bg-neutral-900 text-rose-600 dark:text-rose-400 border border-neutral-300 dark:border-neutral-700 text-[11px] font-bold">
                                          -{res?.attempts}
                                        </div>
                                      </Show>
                                    }
                                  >
                                    <div class="py-1 px-1.5 bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 text-[11px] font-bold">
                                      +{(res?.attempts || 1) > 1 ? res?.attempts : ''}
                                      <span class="block text-[10px] font-normal text-neutral-500 dark:text-neutral-400">
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
