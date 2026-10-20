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
    <div class="flex-1 bg-[#f4f5f7] dark:bg-[#090a0c] text-zinc-900 dark:text-zinc-100 py-6 sm:py-8 px-4 sm:px-6 font-sans transition-colors duration-100 relative">
      <TopProgressBar active={isRefreshing()} />
      <div class="max-w-5xl mx-auto space-y-5">
        {/* Top Header & Actions */}
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#d4d6dc] dark:border-[#262a32]">
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="status-chip bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold border-zinc-900 dark:border-zinc-100">
                Standings
              </span>
              <Show when={selectedContest()}>
                {(c) => (
                  <span
                    class={`status-chip ${
                      c().state === 'RUNNING'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : c().state === 'PAUSED'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                        : c().state === 'FROZEN'
                        ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800'
                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                    }`}
                  >
                    {c().is_paused ? 'Paused' : (c().state === 'RUNNING' ? 'Running' : (c().state === 'FROZEN' ? 'Frozen' : 'Scheduled'))}
                  </span>
                )}
              </Show>
              <Show when={scoreboard()?.is_frozen}>
                <span class="status-chip bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700">
                  Frozen
                </span>
              </Show>
            </div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {scoreboard()?.contest_title || 'Tournament Standings & Leaderboard'}
            </h1>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Live tournament standings updated in real time as submissions are judged &bull; Scoring: <strong class="text-zinc-800 dark:text-zinc-200 uppercase">{selectedContest()?.scoring === 'icpc' ? 'Standard Penalty' : (selectedContest()?.scoring || 'Standard')}</strong> &bull; Asia/Kolkata (IST)
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            {/* Contest Switcher */}
            <Show when={contests().length > 1}>
              <select
                value={selectedContestId()}
                onChange={(e) => setSelectedContestId(e.currentTarget.value)}
                class="notion-input font-medium text-xs py-1"
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
              class="btn-workstation btn-workstation-secondary text-xs flex items-center gap-1.5"
            >
              <Show when={isRefreshing()} fallback={<IconRefresh class="w-3 h-3 text-zinc-600 dark:text-zinc-300" />}>
                <ButtonSpinner class="w-3 h-3 text-zinc-600 dark:text-zinc-300" />
              </Show>
              <span>{isRefreshing() ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div class="flex items-center justify-between gap-4 text-xs">
          <div class="w-full sm:w-72 relative">
            <input
              type="text"
              placeholder="Search competitor or squad..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="notion-input w-full text-xs pr-8"
            />
            <span class="absolute right-2.5 top-2.5 text-zinc-400 dark:text-zinc-500 pointer-events-none">
              <IconSearch class="w-3.5 h-3.5" />
            </span>
          </div>

          <div class="text-zinc-500 dark:text-zinc-400">
            Total: <strong class="text-zinc-900 dark:text-white">{filteredRows().length} participants</strong>
          </div>
        </div>

        {/* Scoreboard Table Card */}
        <Show when={loading()}>
          <TableSkeletonLoader rows={8} columns={problemColumns().length + 4} />
        </Show>

        <Show when={!loading() && (!scoreboard() || filteredRows().length === 0)}>
          <div class="notion-card p-14 text-center bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] rounded-[2px]">
            <div class="w-10 h-10 rounded-[2px] bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center mx-auto mb-3 border border-zinc-300 dark:border-zinc-700">
              <IconTrophy class="w-5 h-5 text-amber-500" />
            </div>
            <h3 class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {contests().length === 0 ? 'No competitions registered' : 'No submissions judged yet'}
            </h3>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              {contests().length === 0
                ? 'An administrator can configure and launch a competition from the Admin Dashboard.'
                : 'The scoreboard will reflect live solve times, points, and penalty logs once participants begin submitting.'}
            </p>
          </div>
        </Show>

        <Show when={!loading() && scoreboard() && filteredRows().length > 0}>
          <div class="notion-card bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#262a32] overflow-hidden rounded-[2px] shadow-[1px_1px_0px_rgba(0,0,0,0.06)] dark:shadow-[1px_1px_0px_rgba(0,0,0,0.4)]">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-[#eaedf1] dark:bg-[#14171d] border-b border-[#d4d6dc] dark:border-[#262a32] text-zinc-700 dark:text-zinc-300 font-semibold text-[11px]">
                  <tr>
                    <th class="py-3 px-3 w-14 text-center border-r border-[#d4d6dc] dark:border-[#262a32]">Rank</th>
                    <th class="py-3 px-4 min-w-[200px] border-r border-[#d4d6dc] dark:border-[#262a32]">Competitor / Squad</th>
                    <th class="py-3 px-3 w-20 text-center border-r border-[#d4d6dc] dark:border-[#262a32]">Solved</th>
                    <th class="py-3 px-3 w-28 text-center border-r border-[#d4d6dc] dark:border-[#262a32]">Score / Pen</th>
                    <Show when={scoreboard()?.rows.some((r) => r.adjustment_points && r.adjustment_points !== 0)}>
                      <th class="py-3 px-3 w-24 text-center border-r border-[#d4d6dc] dark:border-[#262a32]">Adjust</th>
                    </Show>
                    <For each={problemColumns()}>
                      {(label) => (
                        <th class="py-3 px-3 text-center min-w-[65px] font-mono border-r border-[#d4d6dc] dark:border-[#262a32] last:border-r-0">
                          {label}
                        </th>
                      )}
                    </For>
                  </tr>
                </thead>

                <tbody class="divide-y divide-[#d4d6dc] dark:divide-[#262a32] font-mono">
                  <For each={filteredRows()}>
                    {(row) => (
                      <tr class="hover:bg-[#f8f9fa] dark:hover:bg-[#161922] transition">
                        {/* Rank Badge */}
                        <td class="py-2.5 px-3 text-center border-r border-[#d4d6dc] dark:border-[#262a32]">
                          <span
                            class={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-[2px] text-xs font-bold ${
                              row.rank === 1
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border border-amber-400 dark:border-amber-600 font-black'
                                : row.rank === 2
                                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-600 font-bold'
                                : row.rank === 3
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-bold'
                                : 'text-zinc-600 dark:text-zinc-400 font-bold'
                            }`}
                          >
                            #{row.rank}
                          </span>
                        </td>

                        {/* Competitor / Team Name */}
                        <td class="py-2.5 px-4 border-r border-[#d4d6dc] dark:border-[#262a32]">
                          <div class="flex items-center gap-2">
                            <span class="font-bold text-zinc-900 dark:text-white text-xs">
                              {row.team_name || row.user_name}
                            </span>
                            <Show when={row.team_name}>
                              <span class="status-chip bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                                Squad
                              </span>
                            </Show>
                          </div>
                        </td>

                        {/* Solved Count */}
                        <td class="py-2.5 px-3 text-center font-bold text-sm text-zinc-900 dark:text-white border-r border-[#d4d6dc] dark:border-[#262a32]">
                          {row.solved_count}
                        </td>

                        {/* Total Penalty / Points */}
                        <td class="py-2.5 px-3 text-center font-mono text-zinc-700 dark:text-zinc-300 border-r border-[#d4d6dc] dark:border-[#262a32]">
                          {selectedContest()?.scoring === 'points'
                            ? `${row.total_points} PTS`
                            : `${row.total_penalty}M`}
                        </td>

                        {/* Adjustments Column */}
                        <Show when={scoreboard()?.rows.some((r) => r.adjustment_points && r.adjustment_points !== 0)}>
                          <td class="py-2.5 px-3 text-center border-r border-[#d4d6dc] dark:border-[#262a32]">
                            <Show
                              when={row.adjustment_points && row.adjustment_points !== 0}
                              fallback={<span class="text-zinc-300 dark:text-zinc-700">-</span>}
                            >
                              <span
                                title={row.adjustment_reason || 'Admin Adjustment'}
                                class={`px-1.5 py-0.2 rounded-[2px] text-[10px] font-bold ${
                                  (row.adjustment_points || 0) > 0
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
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
                              <td class="py-2 px-2 text-center border-r border-[#d4d6dc] dark:border-[#262a32] last:border-r-0">
                                <Show
                                  when={res}
                                  fallback={<span class="text-zinc-300 dark:text-zinc-700 text-xs">·</span>}
                                >
                                  <Show
                                    when={res?.is_solved}
                                    fallback={
                                      <Show when={(res?.attempts || 0) > 0}>
                                        <div class="p-1 rounded-[2px] bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-mono text-[11px] font-bold">
                                          -{res?.attempts}
                                        </div>
                                      </Show>
                                    }
                                  >
                                    <div class="p-1 rounded-[2px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 font-mono text-[11px] font-bold">
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
