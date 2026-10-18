import { createSignal, createEffect, For, Show } from 'solid-js';

interface Problem {
  slug: string;
  title: string;
  statement_md: string;
  difficulty: string;
  tags: string[];
  time_limit_ms: number;
  memory_mb: number;
  sample_tests: Array<{
    ordinal: number;
    group_name: string;
    input_data: string;
    output_data: string;
  }>;
}

interface TestResult {
  ordinal: number;
  group_name: string;
  verdict: string;
  time_ms: number;
  memory_kb: number;
  instructions: number;
  diagnostic?: string;
}

interface SubmissionVerdict {
  submission_id: string;
  status: string;
  verdict: string;
  total_time_ms: number;
  peak_memory_kb: number;
  total_instructions: number;
  failed_test?: number;
  failed_group?: string;
  compile_output?: string;
  judge_host?: string;
  test_results?: TestResult[];
}

export default function App() {
  const [problem, setProblem] = createSignal<Problem | null>(null);
  const [language, setLanguage] = createSignal('cpp23-gcc');
  const [sourceCode, setSourceCode] = createSignal(`#include <iostream>
#include <vector>
#include <unordered_map>

int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    int n;
    long long target;
    if (!(std::cin >> n >> target)) return 0;

    std::vector<long long> nums(n);
    std::unordered_map<long long, int> seen;
    int ans_i = -1, ans_j = -1;

    for (int i = 0; i < n; ++i) {
        std::cin >> nums[i];
        long long complement = target - nums[i];
        if (ans_i == -1 && seen.contains(complement)) {
            ans_i = seen[complement];
            ans_j = i;
        }
        seen[nums[i]] = i;
    }

    if (ans_i > ans_j) std::swap(ans_i, ans_j);
    std::cout << ans_i << " " << ans_j << "\\n";
    return 0;
}
`);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [currentVerdict, setCurrentVerdict] = createSignal<SubmissionVerdict | null>(null);
  const [statusMessage, setStatusMessage] = createSignal<string>('Ready');
  const [copiedIndex, setCopiedIndex] = createSignal<number | null>(null);

  // Fetch default problem
  createEffect(() => {
    fetch('/api/problems/two-sum')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setProblem(data);
        } else {
          // Fallback demo data if API is offline
          setProblem({
            slug: 'two-sum',
            title: 'Two Sum',
            statement_md: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.`,
            difficulty: 'Easy',
            tags: ['array', 'hash-table', 'two-pointers'],
            time_limit_ms: 1000,
            memory_mb: 256,
            sample_tests: [
              {
                ordinal: 1,
                group_name: 'sample',
                input_data: '4 9\\n2 7 11 15',
                output_data: '0 1',
              },
            ],
          });
        }
      })
      .catch(() => {});
  });

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const submitCode = async (isRunSample: boolean) => {
    setIsSubmitting(true);
    setStatusMessage('QUEUED');
    setCurrentVerdict({
      submission_id: 'pending',
      status: 'QUEUED',
      verdict: 'PENDING',
      total_time_ms: 0,
      peak_memory_kb: 0,
      total_instructions: 0,
    });

    try {
      const res = await fetch('/api/problems/two-sum/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: language(),
          source: sourceCode(),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit code');
      }

      const data = await res.json();
      const submissionId = data.submission_id;

      // Connect to Server-Sent Events stream
      const sse = new EventSource(`/api/submissions/${submissionId}/events`);

      sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.status) {
            setStatusMessage(payload.status);
          }
          if (payload.verdict && payload.verdict !== 'PENDING') {
            setCurrentVerdict(payload.detail || {
              submission_id: submissionId,
              status: payload.status,
              verdict: payload.verdict,
            });
            setIsSubmitting(false);
            sse.close();
          }
        } catch (e) {
          console.error(e);
        }
      };

      sse.addEventListener('submission_update', (event: any) => {
        try {
          const payload = JSON.parse(event.data);
          setStatusMessage(payload.status);
          if (payload.verdict && payload.verdict !== 'PENDING') {
            setCurrentVerdict(payload.detail || {
              submission_id: submissionId,
              status: payload.status,
              verdict: payload.verdict,
            });
            setIsSubmitting(false);
            sse.close();
          }
        } catch (e) {
          console.error(e);
        }
      });

      sse.onerror = () => {
        // Fallback polling if SSE disconnects
        fetch(`/api/submissions/${submissionId}`)
          .then((r) => r.json())
          .then((sub) => {
            if (sub && sub.verdict !== 'PENDING') {
              setCurrentVerdict(sub);
              setIsSubmitting(false);
              sse.close();
            }
          });
      };
    } catch (err: any) {
      setIsSubmitting(false);
      setStatusMessage('Error submitting code');
      console.error(err);
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'AC':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'WA':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      case 'TLE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'CE':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
      case 'RE':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
      default:
        return 'bg-sky-500/20 text-sky-400 border-sky-500/40 animate-pulse';
    }
  };

  return (
    <div class="min-h-screen bg-[#0b0f19] text-slate-200 flex flex-col">
      {/* Top Navigation Bar */}
      <header class="h-14 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            CB
          </div>
          <span class="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Codebench
          </span>
          <span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
            v0.1.0-phase1
          </span>
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-md border border-slate-700/50">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span class="text-slate-400">Host Timing:</span>
            <span class="font-semibold text-emerald-400">Grade C (Docker Desktop)</span>
          </div>
          <div class="text-xs text-slate-400">
            User: <span class="text-slate-200 font-medium">admin@codebench.local</span>
          </div>
        </div>
      </header>

      {/* Main Split Layout */}
      <main class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-hidden">
        {/* Left Column: Problem Statement & Samples */}
        <section class="flex flex-col gap-4 overflow-y-auto pr-2">
          <div class="glass-panel rounded-xl p-6 shadow-xl">
            <Show when={problem()}>
              {(p) => (
                <>
                  <div class="flex items-center justify-between mb-4">
                    <h1 class="text-2xl font-bold text-white tracking-tight">{p().title}</h1>
                    <span class="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {p().difficulty}
                    </span>
                  </div>

                  <div class="flex flex-wrap gap-2 mb-6 text-xs text-slate-400">
                    <span class="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700">
                      ⏱ {p().time_limit_ms} ms
                    </span>
                    <span class="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700">
                      💾 {p().memory_mb} MB
                    </span>
                    <For each={p().tags}>
                      {(tag) => (
                        <span class="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          #{tag}
                        </span>
                      )}
                    </For>
                  </div>

                  <div class="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed mb-6 whitespace-pre-line">
                    {p().statement_md}
                  </div>

                  <h3 class="text-sm font-semibold text-slate-200 mb-3 uppercase tracking-wider">
                    Sample Test Cases
                  </h3>
                  <div class="space-y-4">
                    <For each={p().sample_tests}>
                      {(st, idx) => (
                        <div class="bg-slate-900/80 rounded-lg p-4 border border-slate-800">
                          <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
                            <span>Sample #{st.ordinal}</span>
                            <button
                              onClick={() => handleCopy(st.input_data, idx())}
                              class="hover:text-white transition-colors"
                            >
                              {copiedIndex() === idx() ? 'Copied!' : 'Copy Input'}
                            </button>
                          </div>
                          <div class="grid grid-cols-2 gap-3 text-xs font-mono">
                            <div>
                              <div class="text-[10px] text-slate-500 uppercase mb-1">Input</div>
                              <pre class="bg-slate-950 p-2.5 rounded border border-slate-800/80 overflow-x-auto text-sky-300">
                                {st.input_data}
                              </pre>
                            </div>
                            <div>
                              <div class="text-[10px] text-slate-500 uppercase mb-1">Expected Output</div>
                              <pre class="bg-slate-950 p-2.5 rounded border border-slate-800/80 overflow-x-auto text-emerald-300">
                                {st.output_data}
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
        </section>

        {/* Right Column: Code Editor & Live Verdict Panel */}
        <section class="flex flex-col gap-4 overflow-y-auto">
          {/* Editor Header & Language Selector */}
          <div class="glass-panel rounded-xl p-4 flex items-center justify-between shadow-xl">
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Language:
              </span>
              <select
                value={language()}
                onChange={(e) => setLanguage(e.currentTarget.value)}
                class="bg-slate-900 text-slate-200 text-xs font-medium rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="cpp23-gcc">C++23 (GCC 15)</option>
                <option value="cpp23-clang">C++23 (Clang 19)</option>
                <option value="c23-gcc">C23 (GCC 15)</option>
                <option value="c23-clang">C23 (Clang 19)</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <button
                onClick={() => submitCode(true)}
                disabled={isSubmitting()}
                class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50"
              >
                Run Samples
              </button>
              <button
                onClick={() => submitCode(false)}
                disabled={isSubmitting()}
                class="px-5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 flex items-center gap-2"
              >
                <Show when={isSubmitting()}>
                  <span class="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                </Show>
                Submit Solution
              </button>
            </div>
          </div>

          {/* Code Textarea Area */}
          <div class="glass-panel rounded-xl p-3 flex-1 flex flex-col shadow-xl min-h-[360px]">
            <div class="text-[11px] text-slate-500 mb-2 font-mono flex items-center justify-between">
              <span>solution.cpp</span>
              <span>UTF-8 • LF • -std=c++23 -O2 -static</span>
            </div>
            <textarea
              value={sourceCode()}
              onInput={(e) => setSourceCode(e.currentTarget.value)}
              rows={18}
              spellcheck={false}
              class="w-full flex-1 bg-slate-950/80 rounded-lg p-4 font-mono text-xs text-sky-200 leading-relaxed border border-slate-800/80 focus:outline-none focus:border-indigo-500 resize-none selection:bg-indigo-500/30"
            />
          </div>

          {/* Real-time Verdict Output Panel */}
          <div class="glass-panel rounded-xl p-5 shadow-xl">
            <div class="flex items-center justify-between mb-4">
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Evaluation Verdict & Telemetry
              </span>
              <span class="text-xs font-mono text-slate-500">
                Live State: <strong class="text-slate-300">{statusMessage()}</strong>
              </span>
            </div>

            <Show
              when={currentVerdict()}
              fallback={
                <div class="text-center py-6 text-slate-500 text-xs">
                  Submit code to trigger sandboxed compilation, test case verification, and real-time SSE stream.
                </div>
              }
            >
              {(v) => (
                <div class="space-y-4">
                  <div class="flex items-center justify-between bg-slate-900/80 p-4 rounded-lg border border-slate-800">
                    <div class="flex items-center gap-3">
                      <span
                        class={`px-4 py-1.5 rounded-lg text-sm font-bold border tracking-wider ${getVerdictBadge(
                          v().verdict
                        )}`}
                      >
                        {v().verdict}
                      </span>
                      <span class="text-xs text-slate-400">
                        {v().verdict === 'AC' && 'All test groups passed within limits'}
                        {v().verdict === 'WA' && `Failed test #${v().failed_test || 1} in group ${v().failed_group || 'sample'}`}
                        {v().verdict === 'TLE' && `Execution exceeded ${problem()?.time_limit_ms || 1000} ms`}
                        {v().verdict === 'CE' && 'Compilation failed'}
                        {v().verdict === 'PENDING' && 'Evaluating test cases...'}
                      </span>
                    </div>

                    <div class="flex items-center gap-4 text-xs font-mono text-slate-400">
                      <span>⏱ {v().total_time_ms} ms</span>
                      <span>💾 {v().peak_memory_kb} KB</span>
                    </div>
                  </div>

                  {/* Compile Output if any */}
                  <Show when={v().compile_output}>
                    <div class="bg-rose-950/20 border border-rose-500/30 rounded-lg p-3 text-xs font-mono text-rose-300">
                      <div class="text-[10px] uppercase text-rose-400 mb-1">Compiler Output:</div>
                      <pre class="whitespace-pre-wrap">{v().compile_output}</pre>
                    </div>
                  </Show>

                  {/* Test Cases Breakdown */}
                  <Show when={v().test_results && v().test_results!.length > 0}>
                    <div class="space-y-1.5">
                      <div class="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Test Groups Breakdown
                      </div>
                      <For each={v().test_results}>
                        {(tr) => (
                          <div class="flex items-center justify-between bg-slate-950/60 px-3 py-2 rounded border border-slate-800 text-xs font-mono">
                            <div class="flex items-center gap-3">
                              <span
                                class={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  tr.verdict === 'AC' ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {tr.verdict}
                              </span>
                              <span class="text-slate-300">
                                Test #{tr.ordinal} ({tr.group_name})
                              </span>
                            </div>
                            <div class="flex items-center gap-4 text-slate-400 text-[11px]">
                              <span>{tr.time_ms} ms</span>
                              <span>{tr.memory_kb} KB</span>
                              <Show when={tr.diagnostic}>
                                <span class="text-rose-400">{tr.diagnostic}</span>
                              </Show>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </Show>
          </div>
        </section>
      </main>
    </div>
  );
}
