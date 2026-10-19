import { createSignal, createEffect, onMount, For, Show } from 'solid-js';
import { getBoilerplate } from './templates';

interface ProblemSummary {
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
  time_limit_ms: number;
  memory_mb: number;
}

interface ProblemDetail extends ProblemSummary {
  statement_md: string;
  checker_type: string;
  version: number;
  package_hash: string;
  published_at: string;
  sample_tests: Array<{
    ordinal: number;
    group_name: string;
    input_data: string;
    output_data: string;
  }>;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface SampleResult {
  ordinal: number;
  group_name: string;
  verdict: string;
  time_ms: number;
  memory_kb: number;
  input: string;
  expected: string;
  actual: string;
  diagnostic?: string;
}

interface RunResponse {
  status: string;
  verdict: string;
  compile_output?: string;
  time_ms: number;
  memory_kb: number;
  sample_results: SampleResult[];
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

interface SubmissionHistoryItem {
  id: string;
  problem_slug: string;
  problem_title: string;
  language: string;
  status: string;
  verdict: string;
  time_ms: number;
  memory_kb: number;
  instructions: number;
  created_at: string;
  judged_at?: string;
}

export default function App() {
  // Navigation & Problem selection
  const [problems, setProblems] = createSignal<ProblemSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = createSignal<string>('two-sum');
  const [problem, setProblem] = createSignal<ProblemDetail | null>(null);
  const [isCatalogOpen, setIsCatalogOpen] = createSignal(false);
  const [catalogSearch, setCatalogSearch] = createSignal('');
  const [difficultyFilter, setDifficultyFilter] = createSignal('ALL');

  // Auth & Session
  const [user, setUser] = createSignal<UserProfile | null>(null);
  const [csrfToken, setCsrfToken] = createSignal<string>('');
  const [isAuthOpen, setIsAuthOpen] = createSignal(false);
  const [authMode, setAuthMode] = createSignal<'login' | 'register'>('login');
  const [authName, setAuthName] = createSignal('');
  const [authEmail, setAuthEmail] = createSignal('');
  const [authPassword, setAuthPassword] = createSignal('');
  const [authError, setAuthError] = createSignal('');

  // Code Editor State
  const [language, setLanguage] = createSignal('cpp23-gcc');
  const [sourceCode, setSourceCode] = createSignal(getBoilerplate('two-sum', 'cpp23-gcc'));
  const [copiedIndex, setCopiedIndex] = createSignal<number | null>(null);

  // Tabs & Execution State
  const [activeTab, setActiveTab] = createSignal<'samples' | 'verdict' | 'history'>('samples');
  const [useCustomInput, setUseCustomInput] = createSignal(false);
  const [customInputText, setCustomInputText] = createSignal('');
  const [isRunning, setIsRunning] = createSignal(false);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [runResponse, setRunResponse] = createSignal<RunResponse | null>(null);
  const [currentVerdict, setCurrentVerdict] = createSignal<SubmissionVerdict | null>(null);
  const [pipelineStage, setPipelineStage] = createSignal<string>('IDLE');
  const [submissionsHistory, setSubmissionsHistory] = createSignal<SubmissionHistoryItem[]>([]);

  // Initial load: Fetch User session, Problems list, and Initial problem
  onMount(() => {
    fetchSession();
    fetchProblemsList();

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSubmit();
        } else {
          handleRunCode();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Fetch session on load
  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setCsrfToken(data.csrf_token);
      }
    } catch {
      // Unauthenticated visitor is valid
    }
  };

  // Fetch available problems
  const fetchProblemsList = async () => {
    try {
      const res = await fetch('/api/problems');
      if (res.ok) {
        const data = await res.json();
        setProblems(data || []);
      }
    } catch (e) {
      console.error('Failed to load problems list', e);
    }
  };

  // Load problem details whenever slug changes
  createEffect(() => {
    const slug = selectedSlug();
    if (!slug) return;

    fetch(`/api/problems/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setProblem(data);
          // Restore autosaved draft if present, otherwise default to boilerplate
          const savedDraft = localStorage.getItem(`cb_draft_${slug}_${language()}`);
          if (savedDraft) {
            setSourceCode(savedDraft);
          } else {
            setSourceCode(getBoilerplate(slug, language()));
          }
          fetchSubmissionsHistory(slug);
        }
      })
      .catch((e) => console.error('Failed to fetch problem', e));
  });

  // Autosave code on keystroke
  const handleCodeChange = (val: string) => {
    setSourceCode(val);
    const slug = selectedSlug();
    if (slug) {
      localStorage.setItem(`cb_draft_${slug}_${language()}`, val);
    }
  };

  // Change language and switch boilerplate/draft
  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    const slug = selectedSlug();
    const savedDraft = localStorage.getItem(`cb_draft_${slug}_${newLang}`);
    if (savedDraft) {
      setSourceCode(savedDraft);
    } else {
      setSourceCode(getBoilerplate(slug, newLang));
    }
  };

  // Reset boilerplate
  const handleResetCode = () => {
    if (confirm('Reset editor to clean starter boilerplate for this problem?')) {
      const slug = selectedSlug();
      const tpl = getBoilerplate(slug, language());
      setSourceCode(tpl);
      localStorage.removeItem(`cb_draft_${slug}_${language()}`);
    }
  };

  // Fetch submissions history
  const fetchSubmissionsHistory = async (slug: string) => {
    try {
      const res = await fetch(`/api/submissions?slug=${slug}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setSubmissionsHistory(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  // Auth: Register or Login
  const handleAuthSubmit = async (e: Event) => {
    e.preventDefault();
    setAuthError('');

    const endpoint = authMode() === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload =
      authMode() === 'login'
        ? { email: authEmail(), password: authPassword() }
        : { name: authName(), email: authEmail(), password: authPassword() };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }

      setUser(data.user);
      setCsrfToken(data.csrf_token);
      setIsAuthOpen(false);
      setAuthPassword('');
      setAuthError('');
    } catch (err: any) {
      setAuthError(err.message || 'Network error');
    }
  };

  // Auth: Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setCsrfToken('');
    } catch (e) {
      console.error(e);
    }
  };

  // Execution: Run Code (Samples / Custom)
  const handleRunCode = async () => {
    if (isRunning() || isSubmitting()) return;
    setIsRunning(true);
    setActiveTab('samples');
    setRunResponse(null);

    try {
      const slug = selectedSlug();
      const res = await fetch(`/api/problems/${slug}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: language(),
          source: sourceCode(),
          custom_input: useCustomInput() ? customInputText() : '',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Run request failed');
      }

      const data: RunResponse = await res.json();
      setRunResponse(data);
    } catch (err: any) {
      setRunResponse({
        status: 'DONE',
        verdict: 'SE',
        compile_output: err.message,
        time_ms: 0,
        memory_kb: 0,
        sample_results: [],
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Execution: Submit Solution
  const handleSubmit = async () => {
    if (isSubmitting() || isRunning()) return;
    setIsSubmitting(true);
    setActiveTab('verdict');
    setPipelineStage('QUEUED');
    setCurrentVerdict({
      submission_id: 'submitting...',
      status: 'QUEUED',
      verdict: 'PENDING',
      total_time_ms: 0,
      peak_memory_kb: 0,
      total_instructions: 0,
    });

    try {
      const slug = selectedSlug();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken()) {
        headers['X-CSRF-Token'] = csrfToken();
      }

      const res = await fetch(`/api/problems/${slug}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          language: language(),
          source: sourceCode(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Submission failed');
      }

      const data = await res.json();
      const submissionId = data.submission_id;

      // Subscribe to Server-Sent Events stream
      const sse = new EventSource(`/api/submissions/${submissionId}/events`);

      sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.status) {
            setPipelineStage(payload.status);
          }
          if (payload.verdict && payload.verdict !== 'PENDING') {
            setCurrentVerdict(payload.detail || {
              submission_id: submissionId,
              status: payload.status,
              verdict: payload.verdict,
            });
            setIsSubmitting(false);
            setPipelineStage('DONE');
            fetchSubmissionsHistory(slug);
            sse.close();
          }
        } catch (e) {
          console.error('SSE JSON error', e);
        }
      };

      sse.addEventListener('submission_update', (event: any) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.status) {
            setPipelineStage(payload.status);
          }
          if (payload.verdict && payload.verdict !== 'PENDING') {
            setCurrentVerdict(payload.detail || {
              submission_id: submissionId,
              status: payload.status,
              verdict: payload.verdict,
            });
            setIsSubmitting(false);
            setPipelineStage('DONE');
            fetchSubmissionsHistory(slug);
            sse.close();
          }
        } catch (e) {
          console.error('SSE listener error', e);
        }
      });

      sse.onerror = () => {
        // Fallback polling if SSE disconnects
        fetch(`/api/submissions/${submissionId}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((sub) => {
            if (sub && sub.verdict !== 'PENDING') {
              setCurrentVerdict(sub);
              setIsSubmitting(false);
              setPipelineStage('DONE');
              fetchSubmissionsHistory(slug);
              sse.close();
            }
          });
      };
    } catch (err: any) {
      setIsSubmitting(false);
      setPipelineStage('FAILED');
      setCurrentVerdict({
        submission_id: 'error',
        status: 'FAILED',
        verdict: 'SE',
        compile_output: err.message,
        total_time_ms: 0,
        peak_memory_kb: 0,
        total_instructions: 0,
      });
    }
  };

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'AC':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'WA':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/50';
      case 'TLE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'MLE':
        return 'bg-amber-600/20 text-amber-300 border-amber-600/50';
      case 'CE':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/50';
      case 'RE':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'SE':
        return 'bg-red-600/20 text-red-400 border-red-600/50';
      default:
        return 'bg-sky-500/20 text-sky-400 border-sky-500/40 animate-pulse';
    }
  };

  const getDifficultyBadge = (diff: string) => {
    switch (diff?.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'medium':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'hard':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  // Filtered problems list
  const filteredProblems = () => {
    return problems().filter((p) => {
      const matchSearch =
        catalogSearch() === '' ||
        p.title.toLowerCase().includes(catalogSearch().toLowerCase()) ||
        p.slug.toLowerCase().includes(catalogSearch().toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(catalogSearch().toLowerCase()));
      const matchDiff =
        difficultyFilter() === 'ALL' || p.difficulty.toUpperCase() === difficultyFilter();
      return matchSearch && matchDiff;
    });
  };

  // Line numbers calculation for editor
  const lineCount = () => sourceCode().split('\n').length;

  return (
    <div class="min-h-screen bg-[#0a0e17] text-slate-200 flex flex-col font-sans select-none">
      {/* Top Header */}
      <header class="h-14 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-3 cursor-pointer" onClick={() => setIsCatalogOpen(true)}>
            <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25">
              CB
            </div>
            <span class="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Codebench
            </span>
          </div>

          {/* Quick Problem Switcher Button */}
          <button
            onClick={() => setIsCatalogOpen(true)}
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-medium text-slate-300 transition"
          >
            <span>Problem:</span>
            <span class="text-white font-semibold">{problem()?.title || 'Select Problem'}</span>
            <span class="text-slate-500">▾</span>
          </button>
        </div>

        <div class="flex items-center gap-4">
          {/* Timing Grade Pill */}
          <div class="flex items-center gap-2 text-xs bg-slate-800/60 px-3 py-1.5 rounded-md border border-slate-700/40">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span class="text-slate-400">Sandbox Host:</span>
            <span class="font-semibold text-emerald-400">Grade C (Local)</span>
          </div>

          {/* User Profile / Auth Button */}
          <Show
            when={user()}
            fallback={
              <button
                onClick={() => {
                  setAuthMode('login');
                  setIsAuthOpen(true);
                }}
                class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-md shadow-indigo-500/20 transition"
              >
                Sign In
              </button>
            }
          >
            {(u) => (
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2 text-xs">
                  <div class="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-[11px]">
                    {u().name.charAt(0).toUpperCase()}
                  </div>
                  <span class="text-slate-200 font-medium">{u().name}</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                    {u().role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  class="text-xs text-slate-400 hover:text-rose-400 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </Show>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main class="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-hidden h-[calc(100vh-3.5rem)]">
        {/* Left Column: Problem Statement & Constraints */}
        <section class="flex flex-col gap-4 overflow-y-auto pr-1">
          <div class="glass-panel rounded-xl p-6 shadow-xl flex-1 flex flex-col">
            <Show
              when={problem()}
              fallback={
                <div class="flex items-center justify-center h-64 text-slate-500 text-sm">
                  Loading problem statement...
                </div>
              }
            >
              {(p) => (
                <>
                  <div class="flex items-center justify-between mb-3">
                    <h1 class="text-2xl font-bold text-white tracking-tight">{p().title}</h1>
                    <span
                      class={`px-3 py-1 text-xs font-semibold rounded-full border ${getDifficultyBadge(
                        p().difficulty
                      )}`}
                    >
                      {p().difficulty}
                    </span>
                  </div>

                  <div class="flex flex-wrap items-center gap-2 mb-6 text-xs text-slate-400">
                    <span class="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/80">
                      ⏱ Time Limit: <strong>{p().time_limit_ms} ms</strong>
                    </span>
                    <span class="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/80">
                      💾 Memory Limit: <strong>{p().memory_mb} MB</strong>
                    </span>
                    <span class="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/80">
                      ⚖ Checker: <strong>{p().checker_type}</strong>
                    </span>
                    <For each={p().tags}>
                      {(tag) => (
                        <span class="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          #{tag}
                        </span>
                      )}
                    </For>
                  </div>

                  {/* Problem Description */}
                  <div class="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed mb-6 whitespace-pre-line border-b border-slate-800/80 pb-6">
                    {p().statement_md}
                  </div>

                  {/* Official Sample Tests */}
                  <div class="space-y-4">
                    <div class="flex items-center justify-between">
                      <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Sample Test Cases ({p().sample_tests?.length || 0})
                      </h3>
                      <span class="text-[11px] text-slate-500">
                        Hidden tests quarantined in judge-only storage
                      </span>
                    </div>

                    <div class="space-y-3">
                      <For each={p().sample_tests}>
                        {(st, idx) => (
                          <div class="bg-slate-900/90 rounded-lg p-3.5 border border-slate-800/90">
                            <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
                              <span class="font-semibold text-slate-300">Sample #{st.ordinal}</span>
                              <button
                                onClick={() => handleCopy(st.input_data, idx())}
                                class="hover:text-sky-400 transition-colors text-[11px]"
                              >
                                {copiedIndex() === idx() ? '✓ Copied' : 'Copy Input'}
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
                                <div class="text-[10px] text-slate-500 uppercase mb-1">
                                  Expected Output
                                </div>
                                <pre class="bg-slate-950 p-2.5 rounded border border-slate-800/80 overflow-x-auto text-emerald-300">
                                  {st.output_data}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </>
              )}
            </Show>
          </div>
        </section>

        {/* Right Column: Code Editor & Dual Execution Workspace */}
        <section class="flex flex-col gap-4 overflow-hidden h-full">
          {/* Editor Header Toolbar */}
          <div class="glass-panel rounded-xl px-4 py-2.5 flex items-center justify-between shadow-xl">
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Language:
              </span>
              <select
                value={language()}
                onChange={(e) => handleLanguageChange(e.currentTarget.value)}
                class="bg-slate-900 text-slate-200 text-xs font-medium rounded-lg px-3 py-1.5 border border-slate-700/80 focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="cpp23-gcc">C++23 (GCC 15)</option>
                <option value="cpp23-clang">C++23 (Clang 19)</option>
                <option value="c23-gcc">C23 (GCC 15)</option>
                <option value="c23-clang">C23 (Clang 19)</option>
              </select>

              <button
                onClick={handleResetCode}
                title="Reset code to default boilerplate"
                class="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800/50 hover:bg-slate-800 transition"
              >
                Reset Boilerplate
              </button>
            </div>

            {/* Run & Submit Action Buttons */}
            <div class="flex items-center gap-2">
              <button
                onClick={handleRunCode}
                disabled={isRunning() || isSubmitting()}
                class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <Show when={isRunning()}>
                  <span class="w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin"></span>
                </Show>
                <span>Run Code</span>
                <kbd class="text-[10px] text-slate-500 font-mono">Ctrl+Enter</kbd>
              </button>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting() || isRunning()}
                class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition disabled:opacity-50 flex items-center gap-2"
              >
                <Show when={isSubmitting()}>
                  <span class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                </Show>
                <span>Submit</span>
                <kbd class="text-[10px] text-white/60 font-mono">Ctrl+Shift+Enter</kbd>
              </button>
            </div>
          </div>

          {/* Editor Body with Gutter */}
          <div class="glass-panel rounded-xl p-2.5 flex-1 flex flex-col shadow-xl min-h-[300px] overflow-hidden">
            <div class="text-[11px] text-slate-500 mb-1.5 font-mono flex items-center justify-between px-2">
              <span>{language().startsWith('c23') ? 'solution.c' : 'solution.cpp'}</span>
              <span>Draft Autosaved • UTF-8 • -O2 -static</span>
            </div>

            <div class="flex-1 flex overflow-hidden rounded-lg bg-slate-950/90 border border-slate-800/80">
              {/* Line Numbers Gutter */}
              <div class="w-10 py-3 pr-2 text-right font-mono text-[11px] text-slate-600 select-none bg-slate-950/60 border-r border-slate-800/50 overflow-hidden">
                <For each={Array.from({ length: lineCount() }, (_, i) => i + 1)}>
                  {(n) => <div>{n}</div>}
                </For>
              </div>

              {/* Code Input */}
              <textarea
                value={sourceCode()}
                onInput={(e) => handleCodeChange(e.currentTarget.value)}
                spellcheck={false}
                class="flex-1 bg-transparent p-3 font-mono text-xs text-sky-200 leading-relaxed focus:outline-none resize-none selection:bg-indigo-500/30 overflow-y-auto"
              />
            </div>
          </div>

          {/* Bottom Execution Panel (Tabs: Samples vs Verdict vs History) */}
          <div class="glass-panel rounded-xl p-4 shadow-xl h-64 flex flex-col overflow-hidden">
            {/* Tab Navigation */}
            <div class="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-3">
              <div class="flex items-center gap-4 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('samples')}
                  class={`pb-1 transition ${
                    activeTab() === 'samples'
                      ? 'text-sky-400 border-b-2 border-sky-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Test Results & Custom Run
                </button>
                <button
                  onClick={() => setActiveTab('verdict')}
                  class={`pb-1 transition ${
                    activeTab() === 'verdict'
                      ? 'text-indigo-400 border-b-2 border-indigo-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Live Judge Verdict
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  class={`pb-1 transition ${
                    activeTab() === 'history'
                      ? 'text-purple-400 border-b-2 border-purple-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Submission History ({submissionsHistory().length})
                </button>
              </div>

              <Show when={activeTab() === 'samples'}>
                <label class="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomInput()}
                    onChange={(e) => setUseCustomInput(e.currentTarget.checked)}
                    class="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0"
                  />
                  <span>Custom Testcase</span>
                </label>
              </Show>

              <Show when={activeTab() === 'verdict'}>
                <div class="flex items-center gap-2 text-xs font-mono">
                  <span class="text-slate-500">Pipeline:</span>
                  <span class="text-sky-400 font-semibold">{pipelineStage()}</span>
                </div>
              </Show>
            </div>

            {/* Tab 1 Content: Test Results & Custom Input */}
            <Show when={activeTab() === 'samples'}>
              <div class="flex-1 overflow-y-auto">
                <Show when={useCustomInput()}>
                  <div class="mb-3">
                    <div class="text-[10px] text-slate-400 uppercase font-mono mb-1">
                      Custom Stdin Input:
                    </div>
                    <textarea
                      value={customInputText()}
                      onInput={(e) => setCustomInputText(e.currentTarget.value)}
                      placeholder="Enter custom input here..."
                      rows={3}
                      class="w-full bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-xs text-sky-300 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </Show>

                <Show
                  when={runResponse()}
                  fallback={
                    <div class="text-center py-6 text-slate-500 text-xs">
                      Click <strong>"Run Code"</strong> to test your solution against sample cases or custom input.
                    </div>
                  }
                >
                  {(res) => (
                    <div class="space-y-3">
                      <div class="flex items-center justify-between bg-slate-900/80 p-2.5 rounded border border-slate-800 text-xs">
                        <div class="flex items-center gap-2">
                          <span
                            class={`px-2.5 py-0.5 rounded font-bold border ${getVerdictBadge(
                              res().verdict
                            )}`}
                          >
                            {res().verdict}
                          </span>
                          <span class="text-slate-400">Sample Run Completed</span>
                        </div>
                        <div class="text-slate-400 font-mono text-[11px]">
                          ⏱ {res().time_ms} ms • 💾 {res().memory_kb} KB
                        </div>
                      </div>

                      <Show when={res().compile_output}>
                        <div class="bg-rose-950/20 border border-rose-500/30 rounded p-2.5 text-xs font-mono text-rose-300">
                          <div class="text-[10px] uppercase text-rose-400 mb-1">
                            Compilation Diagnostics:
                          </div>
                          <pre class="whitespace-pre-wrap">{res().compile_output}</pre>
                        </div>
                      </Show>

                      <For each={res().sample_results}>
                        {(sr) => (
                          <div class="bg-slate-950/70 p-3 rounded border border-slate-800 text-xs font-mono space-y-2">
                            <div class="flex items-center justify-between">
                              <span class="font-semibold text-slate-300">
                                Case #{sr.ordinal} ({sr.group_name})
                              </span>
                              <span
                                class={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  sr.verdict === 'AC' ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {sr.verdict}
                              </span>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span class="text-slate-500 block mb-0.5">Expected:</span>
                                <pre class="bg-slate-900 p-1.5 rounded text-emerald-300">
                                  {sr.expected || '(no expected output)'}
                                </pre>
                              </div>
                              <div>
                                <span class="text-slate-500 block mb-0.5">Actual:</span>
                                <pre class="bg-slate-900 p-1.5 rounded text-sky-300">
                                  {sr.actual || '(empty output)'}
                                </pre>
                              </div>
                            </div>
                            <Show when={sr.diagnostic}>
                              <div class="text-rose-400 text-[11px]">{sr.diagnostic}</div>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  )}
                </Show>
              </div>
            </Show>

            {/* Tab 2 Content: Live Verdict Panel */}
            <Show when={activeTab() === 'verdict'}>
              <div class="flex-1 overflow-y-auto">
                <Show
                  when={currentVerdict()}
                  fallback={
                    <div class="text-center py-6 text-slate-500 text-xs">
                      Submit code to observe real-time sandboxed judging.
                    </div>
                  }
                >
                  {(v) => (
                    <div class="space-y-3">
                      {/* Live Pipeline Stepper */}
                      <div class="flex items-center justify-between bg-slate-950/60 p-2.5 rounded border border-slate-800/80 text-xs">
                        <div class="flex items-center gap-2">
                          <span
                            class={`px-3 py-1 rounded text-xs font-bold border ${getVerdictBadge(
                              v().verdict
                            )}`}
                          >
                            {v().verdict}
                          </span>
                          <span class="text-slate-400">
                            {v().verdict === 'AC' && 'Passed all test groups!'}
                            {v().verdict === 'WA' &&
                              `Failed on test #${v().failed_test || 1} (${v().failed_group || 'sample'})`}
                            {v().verdict === 'TLE' && 'Time limit exceeded'}
                            {v().verdict === 'CE' && 'Compilation error'}
                            {v().verdict === 'PENDING' && `Judge State: ${pipelineStage()}`}
                          </span>
                        </div>

                        <div class="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                          <span>⏱ {v().total_time_ms} ms</span>
                          <span>💾 {v().peak_memory_kb} KB</span>
                          <span>⚙ {v().total_instructions.toLocaleString()} inst</span>
                        </div>
                      </div>

                      {/* Compile Diagnostics if any */}
                      <Show when={v().compile_output}>
                        <div class="bg-rose-950/20 border border-rose-500/30 rounded p-2.5 text-xs font-mono text-rose-300">
                          <div class="text-[10px] uppercase text-rose-400 mb-1">Compiler Output:</div>
                          <pre class="whitespace-pre-wrap">{v().compile_output}</pre>
                        </div>
                      </Show>

                      {/* Test Cases Breakdown Grid */}
                      <Show when={v().test_results && v().test_results!.length > 0}>
                        <div class="space-y-1.5">
                          <For each={v().test_results}>
                            {(tr) => (
                              <div class="flex items-center justify-between bg-slate-950/70 px-3 py-1.5 rounded border border-slate-800/60 text-xs font-mono">
                                <div class="flex items-center gap-2">
                                  <span
                                    class={`font-bold text-[11px] ${
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
            </Show>

            {/* Tab 3 Content: Submission History */}
            <Show when={activeTab() === 'history'}>
              <div class="flex-1 overflow-y-auto">
                <Show
                  when={submissionsHistory().length > 0}
                  fallback={
                    <div class="text-center py-6 text-slate-500 text-xs">
                      No submissions recorded for this problem yet.
                    </div>
                  }
                >
                  <table class="w-full text-left text-xs font-mono">
                    <thead class="text-slate-500 border-b border-slate-800 text-[10px] uppercase">
                      <tr>
                        <th class="py-1">Verdict</th>
                        <th class="py-1">Language</th>
                        <th class="py-1">Time</th>
                        <th class="py-1">Memory</th>
                        <th class="py-1">Date</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-800/40">
                      <For each={submissionsHistory()}>
                        {(sub) => (
                          <tr class="hover:bg-slate-900/40 transition">
                            <td class="py-2">
                              <span
                                class={`px-2 py-0.5 rounded text-[10px] font-bold border ${getVerdictBadge(
                                  sub.verdict
                                )}`}
                              >
                                {sub.verdict}
                              </span>
                            </td>
                            <td class="py-2 text-slate-400">{sub.language}</td>
                            <td class="py-2 text-slate-300">{sub.time_ms} ms</td>
                            <td class="py-2 text-slate-300">{sub.memory_kb} KB</td>
                            <td class="py-2 text-slate-500 text-[11px]">
                              {new Date(sub.created_at).toLocaleTimeString()}
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </Show>
              </div>
            </Show>
          </div>
        </section>
      </main>

      {/* Problem Catalog Modal */}
      <Show when={isCatalogOpen()}>
        <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="glass-panel w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-slate-700/80 max-h-[85vh] flex flex-col">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-white">Problem Library (10 Reference Problems)</h2>
              <button
                onClick={() => setIsCatalogOpen(false)}
                class="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Search and Difficulty Filter */}
            <div class="flex items-center gap-3 mb-4">
              <input
                type="text"
                placeholder="Search problems by title, slug, or tag..."
                value={catalogSearch()}
                onInput={(e) => setCatalogSearch(e.currentTarget.value)}
                class="flex-1 bg-slate-900 text-xs text-slate-200 px-3 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500"
              />
              <div class="flex items-center gap-1 text-xs">
                {['ALL', 'EASY', 'MEDIUM', 'HARD'].map((diff) => (
                  <button
                    onClick={() => setDifficultyFilter(diff)}
                    class={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                      difficultyFilter() === diff
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Problems List */}
            <div class="flex-1 overflow-y-auto space-y-2 pr-1">
              <For each={filteredProblems()}>
                {(p) => (
                  <div
                    onClick={() => {
                      setSelectedSlug(p.slug);
                      setIsCatalogOpen(false);
                    }}
                    class={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedSlug() === p.slug
                        ? 'bg-indigo-600/20 border-indigo-500/50'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div class="flex items-center gap-2 mb-1">
                        <span class="font-semibold text-white text-sm">{p.title}</span>
                        <span class="text-xs text-slate-500 font-mono">({p.slug})</span>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <For each={p.tags}>
                          {(t) => (
                            <span class="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                              #{t}
                            </span>
                          )}
                        </For>
                      </div>
                    </div>

                    <div class="flex items-center gap-3">
                      <span
                        class={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getDifficultyBadge(
                          p.difficulty
                        )}`}
                      >
                        {p.difficulty}
                      </span>
                      <span class="text-xs text-slate-500">⏱ {p.time_limit_ms}ms</span>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>

      {/* Auth Modal (Login / Register) */}
      <Show when={isAuthOpen()}>
        <div class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-700/80">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-white">
                {authMode() === 'login' ? 'Sign In to Codebench' : 'Create an Account'}
              </h2>
              <button
                onClick={() => setIsAuthOpen(false)}
                class="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Mode Tabs */}
            <div class="flex border-b border-slate-800 mb-4">
              <button
                onClick={() => setAuthMode('login')}
                class={`flex-1 pb-2 text-xs font-semibold ${
                  authMode() === 'login'
                    ? 'text-sky-400 border-b-2 border-sky-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode('register')}
                class={`flex-1 pb-2 text-xs font-semibold ${
                  authMode() === 'register'
                    ? 'text-sky-400 border-b-2 border-sky-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} class="space-y-3">
              <Show when={authError()}>
                <div class="bg-rose-950/30 border border-rose-500/40 p-2.5 rounded text-xs text-rose-300">
                  {authError()}
                </div>
              </Show>

              <Show when={authMode() === 'register'}>
                <div>
                  <label class="block text-[11px] text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={authName()}
                    onInput={(e) => setAuthName(e.currentTarget.value)}
                    placeholder="Ada Lovelace"
                    class="w-full bg-slate-900 text-xs text-slate-200 px-3 py-2 rounded border border-slate-700 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </Show>

              <div>
                <label class="block text-[11px] text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={authEmail()}
                  onInput={(e) => setAuthEmail(e.currentTarget.value)}
                  placeholder="admin@codebench.local"
                  class="w-full bg-slate-900 text-xs text-slate-200 px-3 py-2 rounded border border-slate-700 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label class="block text-[11px] text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword()}
                  onInput={(e) => setAuthPassword(e.currentTarget.value)}
                  placeholder="Min 8 characters"
                  class="w-full bg-slate-900 text-xs text-slate-200 px-3 py-2 rounded border border-slate-700 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div class="pt-2">
                <button
                  type="submit"
                  class="w-full py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition"
                >
                  {authMode() === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </div>

              <div class="text-center pt-2">
                <span class="text-[11px] text-slate-500">
                  Default Seed Admin: <strong>admin@codebench.local</strong> / <strong>adminpass123</strong>
                </span>
              </div>
            </form>
          </div>
        </div>
      </Show>
    </div>
  );
}
