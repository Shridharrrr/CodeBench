import { createSignal, createEffect, onMount, For, Show } from 'solid-js';
import {
  IconSettings,
  IconPlus,
  IconPlay,
  IconX,
  IconRefresh,
  IconCheck,
  IconTrash,
  IconFileText,
  IconClock,
  IconShield,
  IconEye,
  IconUsers,
  IconUpload,
  IconDownload,
} from './icons';
import MarkdownView from './MarkdownView';
import {
  parseProblemMarkdown,
  generateProblemMarkdownTemplate,
  ParsedProblem,
  TestCaseParsed,
} from './problemMarkdownParser';

interface Contest {
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

interface ScoreAdjustment {
  id: string;
  contest_id: string;
  user_id?: string;
  team_id?: string;
  user_name?: string;
  admin_name?: string;
  points: number;
  reason: string;
  created_at: string;
}

interface Participant {
  user_id: string;
  user_name: string;
  user_email: string;
}

interface AdminTeamMember {
  team_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  joined_at: string;
}

interface AdminTeam {
  id: string;
  name: string;
  join_code: string;
  captain_id: string;
  members: AdminTeamMember[];
  created_at: string;
}

export interface StudioTestCase {
  id: string;
  input: string;
  output: string;
}

// Convert ISO string to IST datetime-local input string "YYYY-MM-DDTHH:mm" (UTC+05:30)
function toISTInputFormat(isoStr?: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  // Shift by 5.5 hours (19,800,000 ms)
  const istDate = new Date(d.getTime() + 19800000);
  return istDate.toISOString().slice(0, 16);
}

// Convert IST datetime-local input string "YYYY-MM-DDTHH:mm" to server ISO string
function fromISTInputFormat(istStr?: string): string {
  if (!istStr) return '';
  const fullIST = istStr.length === 16 ? `${istStr}:00+05:30` : `${istStr}+05:30`;
  const d = new Date(fullIST);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
}

interface AdminDashboardProps {
  csrfToken: string;
}

export default function AdminDashboard(props: AdminDashboardProps) {
  const [activeTab, setActiveTab] = createSignal<'event' | 'adjustments' | 'new_problem' | 'rejudge' | 'teams'>('event');
  const [contests, setContests] = createSignal<Contest[]>([]);
  const [selectedContestId, setSelectedContestId] = createSignal<string>('');
  const [selectedContest, setSelectedContest] = createSignal<Contest | null>(null);

  // Squads / Teams Management
  const [teamsList, setTeamsList] = createSignal<AdminTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = createSignal(false);
  const [teamSearchQuery, setTeamSearchQuery] = createSignal('');
  const [teamMsg, setTeamMsg] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingTeamId, setDeletingTeamId] = createSignal<string | null>(null);

  // Event State Controls
  const [startsAt, setStartsAt] = createSignal('');
  const [endsAt, setEndsAt] = createSignal('');
  const [freezeAt, setFreezeAt] = createSignal('');
  const [scoringMode, setScoringMode] = createSignal('icpc');
  const [isPaused, setIsPaused] = createSignal(false);
  const [isTeamContest, setIsTeamContest] = createSignal(false);
  const [maxTeamSize, setMaxTeamSize] = createSignal(3);
  const [eventMsg, setEventMsg] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);

  // Score Adjustments
  const [adjustments, setAdjustments] = createSignal<ScoreAdjustment[]>([]);
  const [participants, setParticipants] = createSignal<Participant[]>([]);
  const [adjTargetId, setAdjTargetId] = createSignal('');
  const [adjPoints, setAdjPoints] = createSignal<number>(0);
  const [adjReason, setAdjReason] = createSignal('');
  const [adjSubmitting, setAdjSubmitting] = createSignal(false);

  // Dynamic Problem Builder
  const [probTitle, setProbTitle] = createSignal('');
  const [probSlug, setProbSlug] = createSignal('');
  const [probDifficulty, setProbDifficulty] = createSignal('Medium');
  const [probTags, setProbTags] = createSignal('array, algorithms');
  const [probTimeLimit, setProbTimeLimit] = createSignal(1000);
  const [probMemoryLimit, setProbMemoryLimit] = createSignal(256);
  const [probLabel, setProbLabel] = createSignal('K');
  const [probPoints, setProbPoints] = createSignal(100);
  const [probStatement, setProbStatement] = createSignal(
`### Problem Description
Given an array of integers, solve the problem as described.

### Input Format
First line contains integer $N$.
Second line contains $N$ space-separated integers.

### Output Format
Print the single integer answer.

### Constraints
- $1 \\le N \\le 10^5$
- $1 \\le A_i \\le 10^9$
`
  );
  // Multi-testcase authoring state
  const [sampleCases, setSampleCases] = createSignal<StudioTestCase[]>([
    { id: 'sample-1', input: '5\n1 2 3 4 5', output: '15' },
  ]);
  const [hiddenCases, setHiddenCases] = createSignal<StudioTestCase[]>([
    { id: 'hidden-1', input: '4\n10 20 30 40', output: '100' },
  ]);

  const handleAddSampleCase = () => {
    setSampleCases((prev) => [
      ...prev,
      { id: `sample-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, input: '', output: '' },
    ]);
  };

  const handleRemoveSampleCase = (id: string) => {
    if (sampleCases().length <= 1) {
      setSampleCases([{ id: 'sample-1', input: '', output: '' }]);
      return;
    }
    setSampleCases((prev) => prev.filter((tc) => tc.id !== id));
  };

  const handleUpdateSampleCase = (id: string, field: 'input' | 'output', value: string) => {
    setSampleCases((prev) =>
      prev.map((tc) => (tc.id === id ? { ...tc, [field]: value } : tc))
    );
  };

  const handleAddHiddenCase = () => {
    setHiddenCases((prev) => [
      ...prev,
      { id: `hidden-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, input: '', output: '' },
    ]);
  };

  const handleRemoveHiddenCase = (id: string) => {
    if (hiddenCases().length <= 1) {
      setHiddenCases([{ id: 'hidden-1', input: '', output: '' }]);
      return;
    }
    setHiddenCases((prev) => prev.filter((tc) => tc.id !== id));
  };

  const handleUpdateHiddenCase = (id: string, field: 'input' | 'output', value: string) => {
    setHiddenCases((prev) =>
      prev.map((tc) => (tc.id === id ? { ...tc, [field]: value } : tc))
    );
  };

  const [probMsg, setProbMsg] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);
  const [probSubmitting, setProbSubmitting] = createSignal(false);
  const [problemTab, setProblemTab] = createSignal<'write' | 'preview'>('write');

  // Markdown Template Upload & Preview State
  const [isUploadMDModalOpen, setIsUploadMDModalOpen] = createSignal(false);
  const [rawMDInput, setRawMDInput] = createSignal('');
  const [parsedMDPreview, setParsedMDPreview] = createSignal<ParsedProblem | null>(null);
  let fileInputRef: HTMLInputElement | undefined;

  // Rejudge Batch
  const [rejudgeMsg, setRejudgeMsg] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);
  const [rejudgeRunning, setRejudgeRunning] = createSignal(false);

  // Create Competition Modal State
  const [isCreateContestOpen, setIsCreateContestOpen] = createSignal(false);
  const [newTitle, setNewTitle] = createSignal('');
  const [newMode, setNewMode] = createSignal('fixed');
  const [newScoring, setNewScoring] = createSignal('icpc');
  const [newIsTeam, setNewIsTeam] = createSignal(true);
  const [newMaxTeamSize, setNewMaxTeamSize] = createSignal(3);
  const [newDurationMin, setNewDurationMin] = createSignal(120);
  const [creatingContest, setCreatingContest] = createSignal(false);

  onMount(() => {
    fetchContests();
    fetchTeams();
  });

  const fetchTeams = async () => {
    setTeamsLoading(true);
    try {
      const res = await fetch('/api/teams');
      if (res.ok) {
        const data = await res.json();
        setTeamsList(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch teams', e);
    } finally {
      setTeamsLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to permanently delete squad "${teamName}"? All memberships will be removed immediately.`)) return;
    setDeletingTeamId(teamId);
    setTeamMsg(null);
    try {
      const res = await fetch(`/api/admin/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': props.csrfToken,
        },
      });
      if (res.ok) {
        setTeamMsg({ type: 'success', text: `Team "${teamName}" was permanently deleted.` });
        setTeamsList((prev) => prev.filter((t) => t.id !== teamId));
      } else {
        const err = await res.json();
        setTeamMsg({ type: 'error', text: err.error || 'Failed to delete team' });
      }
    } catch (e: any) {
      setTeamMsg({ type: 'error', text: e.message || 'Error occurred while deleting team' });
    } finally {
      setDeletingTeamId(null);
    }
  };

  const fetchContests = async () => {
    try {
      const res = await fetch('/api/contests');
      if (res.ok) {
        const data = await res.json();
        setContests(data || []);
        if (data && data.length > 0 && !selectedContestId()) {
          setSelectedContestId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch contests', e);
    }
  };

  createEffect(() => {
    const cid = selectedContestId();
    if (!cid) return;
    const found = contests().find((c) => c.id === cid);
    if (found) {
      setSelectedContest(found);
      setStartsAt(toISTInputFormat(found.starts_at));
      setEndsAt(toISTInputFormat(found.ends_at));
      setFreezeAt(toISTInputFormat(found.freeze_at));
      setScoringMode(found.scoring || 'icpc');
      setIsPaused(!!found.is_paused);
      setIsTeamContest(!!found.is_team_contest);
      setMaxTeamSize(found.max_team_size || 3);
      fetchAdjustments(cid);
      fetchParticipants(cid);
    }
  });

  const fetchAdjustments = async (cid: string) => {
    try {
      const res = await fetch(`/api/admin/contests/${cid}/adjustments`);
      if (res.ok) {
        const data = await res.json();
        setAdjustments(data || []);
      }
    } catch (e) {
      console.error('Failed to load adjustments', e);
    }
  };

  const fetchParticipants = async (cid: string) => {
    try {
      const res = await fetch(`/api/contests/${cid}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.rows) {
          const list: Participant[] = data.rows.map((r: any) => ({
            user_id: r.user_id,
            user_name: r.user_name,
            user_email: '',
          }));
          setParticipants(list);
          if (list.length > 0 && !adjTargetId()) {
            setAdjTargetId(list[0].user_id);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load participants', e);
    }
  };

  const handleStartContestNow = async () => {
    const cid = selectedContestId();
    if (!cid) return;
    setEventMsg(null);
    try {
      const res = await fetch(`/api/admin/contests/${cid}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
      });
      if (res.ok) {
        setEventMsg({ type: 'success', text: 'Contest has been started immediately!' });
        fetchContests();
      } else {
        const err = await res.json();
        setEventMsg({ type: 'error', text: err.error || 'Failed to start contest' });
      }
    } catch (e: any) {
      setEventMsg({ type: 'error', text: e.message });
    }
  };

  const handleConcludeContestNow = async () => {
    const cid = selectedContestId();
    if (!cid) return;
    if (!confirm('Are you sure you want to conclude this competition immediately? The round will finish and participants will see final rankings.')) return;
    setEventMsg(null);
    try {
      const res = await fetch(`/api/admin/contests/${cid}/conclude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
      });
      if (res.ok) {
        setEventMsg({ type: 'success', text: 'Contest has been concluded!' });
        fetchContests();
      } else {
        const err = await res.json();
        setEventMsg({ type: 'error', text: err.error || 'Failed to conclude contest' });
      }
    } catch (e: any) {
      setEventMsg({ type: 'error', text: e.message });
    }
  };

  const handleCreateNewContest = async (e: Event) => {
    e.preventDefault();
    if (!newTitle().trim()) return;
    setCreatingContest(true);
    try {
      const now = new Date();
      // Defaults to UPCOMING (+24 hours in future). Contest starts strictly when launched by admin!
      const starts = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const ends = new Date(starts.getTime() + newDurationMin() * 60 * 1000);

      const res = await fetch('/api/contests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify({
          title: newTitle().trim(),
          mode: newMode(),
          scoring: newScoring(),
          is_team_contest: newIsTeam(),
          max_team_size: Number(newMaxTeamSize()),
          starts_at: starts.toISOString(),
          ends_at: ends.toISOString(),
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setIsCreateContestOpen(false);
        setNewTitle('');
        await fetchContests();
        setSelectedContestId(created.id);
        setEventMsg({
          type: 'success',
          text: `Competition "${created.title}" configured in UPCOMING state! Click "Start Contest Immediately" when you are ready to begin.`,
        });
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create competition');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCreatingContest(false);
    }
  };

  const handleDeleteContest = async () => {
    const cid = selectedContestId();
    if (!cid) return;
    if (!confirm('Are you sure you want to delete this competition? All associated test results and problems will be removed.')) return;
    try {
      const res = await fetch(`/api/admin/contests/${cid}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': props.csrfToken,
        },
      });

      if (res.ok) {
        setSelectedContestId('');
        setSelectedContest(null);
        await fetchContests();
        setEventMsg({ type: 'success', text: 'Competition deleted successfully.' });
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete contest');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSaveContestState = async () => {
    const cid = selectedContestId();
    if (!cid) return;
    setEventMsg(null);
    try {
      const body: any = {
        scoring: scoringMode(),
        is_paused: isPaused(),
        is_team_contest: isTeamContest(),
        max_team_size: Number(maxTeamSize()),
      };
      if (startsAt()) body.starts_at = fromISTInputFormat(startsAt());
      if (endsAt()) body.ends_at = fromISTInputFormat(endsAt());
      if (freezeAt()) body.freeze_at = fromISTInputFormat(freezeAt());

      const res = await fetch(`/api/admin/contests/${cid}/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEventMsg({ type: 'success', text: 'Contest settings saved and broadcasted to clients!' });
        fetchContests();
      } else {
        const err = await res.json();
        setEventMsg({ type: 'error', text: err.error || 'Failed to update contest state' });
      }
    } catch (e: any) {
      setEventMsg({ type: 'error', text: e.message });
    }
  };

  const handleAddAdjustment = async (e: Event) => {
    e.preventDefault();
    const cid = selectedContestId();
    if (!cid || !adjTargetId() || !adjReason().trim() || adjPoints() === 0) {
      alert('Please select a participant, non-zero points, and specify an adjudication reason.');
      return;
    }

    setAdjSubmitting(true);
    try {
      const res = await fetch(`/api/admin/contests/${cid}/adjustments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify({
          user_id: adjTargetId(),
          points: Number(adjPoints()),
          reason: adjReason().trim(),
        }),
      });

      if (res.ok) {
        setAdjPoints(0);
        setAdjReason('');
        fetchAdjustments(cid);
        alert('Score adjustment logged successfully and applied to live leaderboard!');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to record adjustment');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAdjSubmitting(false);
    }
  };

  const handleCreateDynamicProblem = async (e: Event) => {
    e.preventDefault();
    if (!probTitle().trim() || !probSlug().trim() || !probStatement().trim()) {
      setProbMsg({ type: 'error', text: 'Title, slug, and statement are required.' });
      return;
    }

    setProbSubmitting(true);
    setProbMsg(null);
    try {
      const tagsArray = probTags().split(',').map((t) => t.trim()).filter(Boolean);
      const sampleTests = sampleCases()
        .filter((tc) => tc.input.trim() || tc.output.trim())
        .map((t, idx) => ({
          group_name: 'sample',
          ordinal: idx + 1,
          input_data: t.input,
          output_data: t.output,
          is_sample: true,
        }));

      const hiddenTests = hiddenCases()
        .filter((tc) => tc.input.trim() || tc.output.trim())
        .map((t, idx) => ({
          group_name: 'hidden',
          ordinal: idx + 1,
          input_data: t.input,
          output_data: t.output,
          is_sample: false,
        }));

      if (sampleTests.length === 0) {
        setProbMsg({ type: 'error', text: 'At least one visible sample test case is required.' });
        return;
      }
      if (hiddenTests.length === 0) {
        setProbMsg({ type: 'error', text: 'At least one hidden quarantined test case is required.' });
        return;
      }

      const body = {
        title: probTitle().trim(),
        slug: probSlug().trim().toLowerCase(),
        statement_md: probStatement(),
        difficulty: probDifficulty(),
        tags: tagsArray,
        time_limit_ms: Number(probTimeLimit()),
        memory_mb: Number(probMemoryLimit()),
        checker_type: 'token',
        sample_tests: sampleTests,
        hidden_tests: hiddenTests,
        contest_id: selectedContestId() || undefined,
        contest_label: probLabel().toUpperCase(),
        points: Number(probPoints()),
      };

      const res = await fetch('/api/admin/problems/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setProbMsg({ type: 'success', text: `Problem "${probTitle()}" created and linked to Contest as Problem ${probLabel()}!` });
        setProbTitle('');
        setProbSlug('');
      } else {
        const err = await res.json();
        setProbMsg({ type: 'error', text: err.error || 'Failed to create problem' });
      }
    } catch (e: any) {
      setProbMsg({ type: 'error', text: e.message });
    } finally {
      setProbSubmitting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = generateProblemMarkdownTemplate();
    const blob = new Blob([template], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codebench-problem-template.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMDFileSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      setRawMDInput(text);
      const parsed = parseProblemMarkdown(text);
      setParsedMDPreview(parsed);
      setIsUploadMDModalOpen(true);
    };
    reader.readAsText(file);
  };

  const handleApplyParsedProblem = (parsed: ParsedProblem) => {
    if (parsed.title) setProbTitle(parsed.title);
    if (parsed.slug) setProbSlug(parsed.slug);
    if (parsed.difficulty) setProbDifficulty(parsed.difficulty);
    if (parsed.tags.length > 0) setProbTags(parsed.tags.join(', '));
    if (parsed.time_limit_ms) setProbTimeLimit(parsed.time_limit_ms);
    if (parsed.memory_mb) setProbMemoryLimit(parsed.memory_mb);
    if (parsed.contest_label) setProbLabel(parsed.contest_label);
    if (parsed.points) setProbPoints(parsed.points);
    if (parsed.statement_md) setProbStatement(parsed.statement_md);

    if (parsed.sample_tests && parsed.sample_tests.length > 0) {
      setSampleCases(
        parsed.sample_tests.map((st, i) => ({
          id: `sample-${i + 1}-${Date.now()}`,
          input: st.input_data,
          output: st.output_data,
        }))
      );
    }
    if (parsed.hidden_tests && parsed.hidden_tests.length > 0) {
      setHiddenCases(
        parsed.hidden_tests.map((ht, i) => ({
          id: `hidden-${i + 1}-${Date.now()}`,
          input: ht.input_data,
          output: ht.output_data,
        }))
      );
    }

    setIsUploadMDModalOpen(false);
    setProbMsg({
      type: 'success',
      text: `Imported "${parsed.title}" (${parsed.sample_tests?.length || 0} sample tests, ${parsed.hidden_tests?.length || 0} hidden tests) into Authoring Studio!`,
    });
  };

  const handleDirectPublishParsed = async (parsed: ParsedProblem) => {
    setProbSubmitting(true);
    setProbMsg(null);
    try {
      const body = {
        title: parsed.title,
        slug: parsed.slug,
        statement_md: parsed.statement_md,
        difficulty: parsed.difficulty,
        tags: parsed.tags,
        time_limit_ms: parsed.time_limit_ms,
        memory_mb: parsed.memory_mb,
        checker_type: parsed.checker_type || 'token',
        sample_tests: parsed.sample_tests.map((t, idx) => ({
          group_name: 'sample',
          ordinal: idx + 1,
          input_data: t.input_data,
          output_data: t.output_data,
          is_sample: true,
        })),
        hidden_tests: parsed.hidden_tests.map((t, idx) => ({
          group_name: 'hidden',
          ordinal: idx + 1,
          input_data: t.input_data,
          output_data: t.output_data,
          is_sample: false,
        })),
        contest_id: selectedContestId() || undefined,
        contest_label: parsed.contest_label || probLabel().toUpperCase(),
        points: parsed.points || Number(probPoints()),
      };

      const res = await fetch('/api/admin/problems/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setProbMsg({
          type: 'success',
          text: `Problem "${parsed.title}" published and linked to Contest as Problem ${parsed.contest_label || probLabel()}!`,
        });
        setIsUploadMDModalOpen(false);
      } else {
        const err = await res.json();
        setProbMsg({ type: 'error', text: err.error || 'Failed to create problem' });
      }
    } catch (e: any) {
      setProbMsg({ type: 'error', text: e.message });
    } finally {
      setProbSubmitting(false);
    }
  };

  const handleTriggerRejudge = async () => {
    setRejudgeRunning(true);
    setRejudgeMsg(null);
    try {
      const res = await fetch('/api/admin/rejudge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': props.csrfToken,
        },
        body: JSON.stringify({
          contest_id: selectedContestId() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setRejudgeMsg({ type: 'success', text: `Rejudge batch dispatched! Batch ID: ${data.batch_id || 'Queued'}` });
      } else {
        const err = await res.json();
        setRejudgeMsg({ type: 'error', text: err.error || 'Failed to dispatch rejudge' });
      }
    } catch (e: any) {
      setRejudgeMsg({ type: 'error', text: e.message });
    } finally {
      setRejudgeRunning(false);
    }
  };

  return (
    <div class="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Top Header */}
      <div class="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800 gap-4">
        <div>
          <div class="flex items-center gap-3">
            <span class="px-2.5 py-0.5 text-xs font-semibold bg-slate-900 dark:bg-slate-800 text-white rounded-md">
              Control Center
            </span>
            <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Admin Operations
            </h1>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage competition schedules, squad rules, point adjudication, and author custom questions.
          </p>
        </div>

        {/* Contest Switcher & New Contest Button */}
        <div class="flex flex-wrap items-center gap-3">
          <Show when={contests().length > 0}>
            <div class="flex items-center gap-2">
              <label class="text-xs font-semibold text-slate-500 dark:text-slate-400">Contest:</label>
              <select
                value={selectedContestId()}
                onChange={(e) => setSelectedContestId(e.currentTarget.value)}
                class="notion-input font-medium text-xs min-w-[220px]"
              >
                <For each={contests()}>
                  {(c) => (
                    <option value={c.id}>
                      {c.title} ({c.scoring.toUpperCase()})
                    </option>
                  )}
                </For>
              </select>
            </div>
          </Show>

          <button
            onClick={() => setIsCreateContestOpen(true)}
            class="px-4 py-2 rounded-md text-xs font-bold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs flex items-center gap-2"
          >
            <IconPlus class="w-3.5 h-3.5" />
            <span>New Competition</span>
          </button>
        </div>
      </div>

      {/* Spacious Segmented Tabs Navigation */}
      <div class="flex flex-wrap items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('event')}
          class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab() === 'event'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <IconClock class="w-4 h-4 text-slate-500" />
          <span>Competition Schedule & Controls</span>
        </button>

        <button
          onClick={() => setActiveTab('new_problem')}
          class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab() === 'new_problem'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <IconFileText class="w-4 h-4 text-slate-500" />
          <span>Problem Authoring Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('adjustments')}
          class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab() === 'adjustments'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <IconShield class="w-4 h-4 text-slate-500" />
          <span>Score Adjustments & Penalties</span>
        </button>

        <button
          onClick={() => setActiveTab('rejudge')}
          class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab() === 'rejudge'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <IconRefresh class="w-4 h-4 text-slate-500" />
          <span>Cluster & Rejudge</span>
        </button>

        <button
          onClick={() => { setActiveTab('teams'); fetchTeams(); }}
          class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab() === 'teams'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <IconUsers class="w-4 h-4 text-slate-500" />
          <span>Squads & Rosters</span>
          <Show when={teamsList().length > 0}>
            <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
              {teamsList().length}
            </span>
          </Show>
        </button>
      </div>

      {/* Tab 1: Event Controls & Timing */}
      <Show when={activeTab() === 'event'}>
        <Show
          when={contests().length > 0}
          fallback={
            <div class="notion-card p-12 text-center bg-white dark:bg-slate-900 space-y-4">
              <div class="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                <IconSettings class="w-8 h-8" />
              </div>
              <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">No Competitions Configured Yet</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Initialize your first competition below to set duration, scoring rules, and squad modes. Contests remain in UPCOMING state until you explicitly click "Start Contest Immediately".
              </p>
              <div class="pt-2">
                <button
                  onClick={() => setIsCreateContestOpen(true)}
                  class="px-5 py-2.5 rounded-md text-xs font-bold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs inline-flex items-center gap-2"
                >
                  <IconPlus class="w-3.5 h-3.5" />
                  <span>Create Competition</span>
                </button>
              </div>
            </div>
          }
        >
          <div class="space-y-6">
            {/* Live Competition Hero Status & Control Banner */}
            <div class="notion-card p-6 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div class="space-y-2">
                <div class="flex items-center gap-3">
                  <span
                    class={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      (selectedContest()?.state || '').toUpperCase() === 'RUNNING' && !isPaused()
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                        : isPaused()
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                        : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
                    }`}
                  >
                    <span class="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                    <span>{isPaused() ? 'Contest Paused' : selectedContest()?.state || 'UPCOMING'}</span>
                  </span>
                  <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {selectedContest()?.title}
                  </h2>
                </div>

                <div class="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>Scoring: <strong class="text-slate-800 dark:text-slate-200">{scoringMode().toUpperCase()}</strong></span>
                  <span>Squad Mode: <strong class="text-slate-800 dark:text-slate-200">{isTeamContest() ? `Squads of ${maxTeamSize()}` : 'Solo Mode'}</strong></span>
                  <span>Registered: <strong class="text-slate-800 dark:text-slate-200">{participants().length} participants</strong></span>
                </div>
              </div>

              {/* Primary Orchestration Action */}
              <div class="flex items-center gap-3">
                <button
                  onClick={() => setIsPaused(!isPaused())}
                  class={`px-4 py-2.5 rounded-md text-xs font-semibold transition border ${
                    isPaused()
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isPaused() ? 'Resume Competition' : 'Pause Competition'}
                </button>

                <Show
                  when={(selectedContest()?.state || '').toUpperCase() === 'RUNNING'}
                  fallback={
                    <button
                      onClick={handleStartContestNow}
                      class="px-5 py-2.5 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs flex items-center gap-2"
                    >
                      <IconPlay class="w-3.5 h-3.5 fill-current" />
                      <span>Start Contest Immediately</span>
                    </button>
                  }
                >
                  <button
                    onClick={handleConcludeContestNow}
                    class="px-5 py-2.5 rounded-md text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-xs flex items-center gap-2"
                  >
                    <IconX class="w-3.5 h-3.5" />
                    <span>Conclude Contest Now</span>
                  </button>
                </Show>
              </div>
            </div>

            {/* Notification Banner */}
            <Show when={eventMsg()}>
              {(msg) => (
                <div
                  class={`p-4 rounded-lg text-xs font-medium flex items-center justify-between ${
                    msg().type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                  }`}
                >
                  <span>{msg().text}</span>
                  <button onClick={() => setEventMsg(null)} class="text-current opacity-70 hover:opacity-100">
                    <IconX class="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </Show>

            {/* Two Spacious Configuration Cards */}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Schedule & Timing */}
              <div class="notion-card p-6 space-y-5">
                <div>
                  <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">Schedule & Timers</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Configure official competition start, conclusion, and scoreboard freeze thresholds in Indian Standard Time (IST).
                  </p>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Scheduled Start Time (IST)
                    </label>
                    <input
                      type="datetime-local"
                      value={startsAt()}
                      onInput={(e) => setStartsAt(e.currentTarget.value)}
                      class="notion-input w-full"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Scheduled End Time (IST)
                    </label>
                    <input
                      type="datetime-local"
                      value={endsAt()}
                      onInput={(e) => setEndsAt(e.currentTarget.value)}
                      class="notion-input w-full"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Scoreboard Freeze Threshold (IST)
                    </label>
                    <input
                      type="datetime-local"
                      value={freezeAt()}
                      onInput={(e) => setFreezeAt(e.currentTarget.value)}
                      class="notion-input w-full"
                    />
                    <p class="text-[11px] text-slate-400 mt-1">
                      All schedules are configured and evaluated in Indian Standard Time (IST, UTC+05:30). Standings freeze after this threshold.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 2: Scoring & Squad Rules */}
              <div class="notion-card p-6 space-y-5">
                <div>
                  <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">Scoring & Squad Rules</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select how solutions are evaluated and team formations are governed.
                  </p>
                </div>

                <div class="space-y-4">
                  <div>
                    <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Scoring System
                    </label>
                    <select
                      value={scoringMode()}
                      onChange={(e) => setScoringMode(e.currentTarget.value)}
                      class="notion-input w-full"
                    >
                      <option value="icpc">ICPC (Solved Count + 20-Minute Wrong Submission Penalty)</option>
                      <option value="points">Flat Points (Fixed score per problem, zero penalty)</option>
                      <option value="ctfd">Dynamic Points (Points decay with solve count)</option>
                    </select>
                  </div>

                  <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="text-xs font-bold text-slate-900 dark:text-slate-100">Team Competition Mode</span>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400">
                          Allow contestants to form squads and register via invite codes
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={isTeamContest()}
                        onChange={(e) => setIsTeamContest(e.currentTarget.checked)}
                        class="w-4 h-4 text-slate-900 rounded"
                      />
                    </div>

                    <Show when={isTeamContest()}>
                      <div class="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <label class="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Maximum Members per Squad:
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={maxTeamSize()}
                          onInput={(e) => setMaxTeamSize(Number(e.currentTarget.value))}
                          class="notion-input w-24 text-center font-bold"
                        />
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Action Footer */}
            <div class="flex items-center justify-between p-4 notion-card bg-slate-50/60 dark:bg-slate-900">
              <span class="text-xs text-slate-500 dark:text-slate-400">
                Changes to schedule or scoring are broadcast instantly to active contestant sessions.
              </span>
              <button
                onClick={handleSaveContestState}
                class="px-6 py-2.5 rounded-md text-xs font-bold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs"
              >
                Save & Broadcast Settings
              </button>
            </div>

            {/* Separated Danger Zone */}
            <div class="p-6 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 class="text-xs font-bold text-rose-800 dark:text-rose-400">Delete This Competition</h4>
                <p class="text-[11px] text-rose-600 dark:text-rose-500 mt-0.5">
                  Permanently remove this competition, its leaderboard entries, and associated submissions.
                </p>
              </div>
              <button
                onClick={handleDeleteContest}
                class="px-4 py-2 rounded-md text-xs font-semibold bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
              >
                Delete Competition
              </button>
            </div>
          </div>
        </Show>
      </Show>

      {/* Tab 2: Dynamic Problem Builder */}
      <Show when={activeTab() === 'new_problem'}>
        <div class="notion-card p-6 space-y-6">
          <div class="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Problem Authoring Studio</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Author custom questions or directly upload standard .md problem templates with visible & hidden test cases.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".md,.markdown"
                class="hidden"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) handleMDFileSelected(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef?.click()}
                class="px-3 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition shadow-2xs flex items-center gap-1.5"
                title="Upload Markdown Problem File"
              >
                <IconUpload class="w-3.5 h-3.5 text-blue-500" />
                <span>Upload .md Problem</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const tmpl = generateProblemMarkdownTemplate();
                  setRawMDInput(tmpl);
                  setParsedMDPreview(parseProblemMarkdown(tmpl));
                  setIsUploadMDModalOpen(true);
                }}
                class="px-3 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition shadow-2xs flex items-center gap-1.5"
                title="Paste or Edit Raw Markdown Template"
              >
                <IconFileText class="w-3.5 h-3.5 text-slate-500" />
                <span>Paste .md Template</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                class="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5"
                title="Download Sample .md Template File"
              >
                <IconDownload class="w-3.5 h-3.5 text-slate-500" />
                <span>Download Template</span>
              </button>
            </div>
          </div>

          <Show when={sampleCases().length > 1 || hiddenCases().length > 1}>
            <div class="flex items-center justify-between p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-xs text-blue-800 dark:text-blue-300">
              <div class="flex items-center gap-2">
                <IconCheck class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Multi-testcase suite active: <strong>{sampleCases().length}</strong> visible sample tests and <strong>{hiddenCases().length}</strong> hidden tests configured.</span>
              </div>
            </div>
          </Show>

          <Show when={probMsg()}>
            {(msg) => (
              <div
                class={`p-3 rounded-md text-xs font-medium flex items-center justify-between ${
                  msg().type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                }`}
              >
                <span>{msg().text}</span>
                <button onClick={() => setProbMsg(null)} class="text-current opacity-70 hover:opacity-100">
                  <IconX class="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </Show>

          <form onSubmit={handleCreateDynamicProblem} class="space-y-6">
            {/* Identity & Limits Grid */}
            <div class="p-5 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
              <h3 class="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                1. Metadata & Execution Bounds
              </h3>

              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="md:col-span-2">
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Problem Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Subarray Max XOR"
                    value={probTitle()}
                    onInput={(e) => {
                      setProbTitle(e.currentTarget.value);
                      setProbSlug(e.currentTarget.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                    }}
                    class="notion-input w-full"
                    required
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    URL Identifier (Slug)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. subarray-max-xor"
                    value={probSlug()}
                    onInput={(e) => setProbSlug(e.currentTarget.value)}
                    class="notion-input w-full font-mono text-xs"
                    required
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={probDifficulty()}
                    onChange={(e) => setProbDifficulty(e.currentTarget.value)}
                    class="notion-input w-full"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contest Label (e.g. A, B, C)
                  </label>
                  <input
                    type="text"
                    value={probLabel()}
                    onInput={(e) => setProbLabel(e.currentTarget.value)}
                    class="notion-input w-full font-bold uppercase text-center"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Award Points
                  </label>
                  <input
                    type="number"
                    value={probPoints()}
                    onInput={(e) => setProbPoints(Number(e.currentTarget.value))}
                    class="notion-input w-full font-bold text-center"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Time Limit (ms)
                  </label>
                  <input
                    type="number"
                    value={probTimeLimit()}
                    onInput={(e) => setProbTimeLimit(Number(e.currentTarget.value))}
                    class="notion-input w-full text-center"
                  />
                </div>

                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Memory Limit (MB)
                  </label>
                  <input
                    type="number"
                    value={probMemoryLimit()}
                    onInput={(e) => setProbMemoryLimit(Number(e.currentTarget.value))}
                    class="notion-input w-full text-center"
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tags (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="array, dynamic-programming, greedy"
                  value={probTags()}
                  onInput={(e) => setProbTags(e.currentTarget.value)}
                  class="notion-input w-full text-xs"
                />
              </div>
            </div>

            {/* Markdown Statement with Live Preview Tab */}
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  2. Statement Formulation
                </label>
                <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setProblemTab('write')}
                    class={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                      problemTab() === 'write'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <IconFileText class="w-3.5 h-3.5" />
                    <span>Write</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProblemTab('preview')}
                    class={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                      problemTab() === 'preview'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <IconEye class="w-3.5 h-3.5" />
                    <span>Live Preview</span>
                  </button>
                </div>
              </div>

              <Show when={problemTab() === 'write'}>
                <textarea
                  rows="9"
                  value={probStatement()}
                  onInput={(e) => setProbStatement(e.currentTarget.value)}
                  class="notion-input w-full font-mono text-xs leading-relaxed"
                  placeholder="Write statement in Markdown. Supports inline LaTeX math like $O(N)$ or $1 \le N \le 10^5$."
                  required
                />
              </Show>

              <Show when={problemTab() === 'preview'}>
                <div class="p-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 min-h-[180px]">
                  <MarkdownView content={probStatement()} />
                </div>
              </Show>
            </div>

            {/* Test Cases Studio (Multi-Testcase Builder: Public vs Quarantined) */}
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider block">
                    3. Test Cases Studio
                  </label>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Define multiple public sample test cases (visible in contest arena) and multiple secret hidden test cases (for automated judging).
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Public Sample Test Cases Column */}
                <div class="p-5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
                  <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/80">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-slate-900 dark:text-slate-100">Visible Sample Cases</span>
                      <span class="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        {sampleCases().length} Visible
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddSampleCase}
                      class="px-2.5 py-1 rounded text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 transition flex items-center gap-1 shadow-2xs"
                    >
                      <IconPlus class="w-3 h-3" />
                      <span>Add Sample</span>
                    </button>
                  </div>

                  <div class="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    <For each={sampleCases()}>
                      {(tc, idx) => (
                        <div class="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-750 shadow-2xs space-y-2.5">
                          <div class="flex items-center justify-between text-xs">
                            <span class="font-bold text-slate-800 dark:text-slate-200">
                              Sample #{idx() + 1}
                            </span>
                            <Show when={sampleCases().length > 1}>
                              <button
                                type="button"
                                onClick={() => handleRemoveSampleCase(tc.id)}
                                class="text-rose-500 hover:text-rose-700 text-xs font-semibold flex items-center gap-1 transition"
                                title="Remove test case"
                              >
                                <IconTrash class="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            </Show>
                          </div>

                          <div class="space-y-2">
                            <div>
                              <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                Standard Input
                              </label>
                              <textarea
                                rows="2"
                                value={tc.input}
                                onInput={(e) => handleUpdateSampleCase(tc.id, 'input', e.currentTarget.value)}
                                placeholder="Sample input..."
                                class="notion-input w-full font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                Expected Output
                              </label>
                              <textarea
                                rows="2"
                                value={tc.output}
                                onInput={(e) => handleUpdateSampleCase(tc.id, 'output', e.currentTarget.value)}
                                placeholder="Expected stdout..."
                                class="notion-input w-full font-mono text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>

                {/* Quarantined Hidden Test Cases Column */}
                <div class="p-5 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
                  <div class="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/80">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-slate-900 dark:text-slate-100">Hidden Test Cases</span>
                      <span class="text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                        {hiddenCases().length} Quarantined
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddHiddenCase}
                      class="px-2.5 py-1 rounded text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/80 transition flex items-center gap-1 shadow-2xs"
                    >
                      <IconPlus class="w-3 h-3" />
                      <span>Add Hidden</span>
                    </button>
                  </div>

                  <div class="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    <For each={hiddenCases()}>
                      {(tc, idx) => (
                        <div class="p-3.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-750 shadow-2xs space-y-2.5">
                          <div class="flex items-center justify-between text-xs">
                            <span class="font-bold text-slate-800 dark:text-slate-200">
                              Hidden Case #{idx() + 1}
                            </span>
                            <Show when={hiddenCases().length > 1}>
                              <button
                                type="button"
                                onClick={() => handleRemoveHiddenCase(tc.id)}
                                class="text-rose-500 hover:text-rose-700 text-xs font-semibold flex items-center gap-1 transition"
                                title="Remove test case"
                              >
                                <IconTrash class="w-3 h-3" />
                                <span>Remove</span>
                              </button>
                            </Show>
                          </div>

                          <div class="space-y-2">
                            <div>
                              <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                Hidden Input
                              </label>
                              <textarea
                                rows="2"
                                value={tc.input}
                                onInput={(e) => handleUpdateHiddenCase(tc.id, 'input', e.currentTarget.value)}
                                placeholder="Hidden test input..."
                                class="notion-input w-full font-mono text-xs"
                              />
                            </div>
                            <div>
                              <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                Expected Output
                              </label>
                              <textarea
                                rows="2"
                                value={tc.output}
                                onInput={(e) => handleUpdateHiddenCase(tc.id, 'output', e.currentTarget.value)}
                                placeholder="Expected stdout..."
                                class="notion-input w-full font-mono text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div class="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="submit"
                disabled={probSubmitting()}
                class="px-6 py-2.5 rounded-md text-xs font-bold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs disabled:opacity-50 flex items-center gap-2"
              >
                <IconCheck class="w-3.5 h-3.5 text-white" />
                <span>{probSubmitting() ? 'Publishing...' : 'Publish Problem to Contest'}</span>
              </button>
            </div>
          </form>
        </div>
      </Show>

      {/* Tab 3: Score Adjustments & Penalties */}
      <Show when={activeTab() === 'adjustments'}>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Adjudication Form Card */}
          <div class="notion-card p-6 h-fit space-y-4">
            <div>
              <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100">Adjudicate Points</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Grant bonus points (e.g. first blood) or levy penalties (e.g. code sharing).
              </p>
            </div>

            <form onSubmit={handleAddAdjustment} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Participant
                </label>
                <select
                  value={adjTargetId()}
                  onChange={(e) => setAdjTargetId(e.currentTarget.value)}
                  class="notion-input w-full text-xs"
                >
                  <option value="">Select a participant...</option>
                  <For each={participants()}>
                    {(p) => <option value={p.user_id}>{p.user_name} ({p.user_email})</option>}
                  </For>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Points Adjustment (+ Award, - Deduction)
                </label>
                <input
                  type="number"
                  placeholder="+50 or -100"
                  value={adjPoints() || ''}
                  onInput={(e) => setAdjPoints(Number(e.currentTarget.value))}
                  class="notion-input w-full font-bold"
                />

                {/* Quick Presets */}
                <div class="flex items-center gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setAdjPoints(20)}
                    class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                  >
                    +20
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjPoints(50)}
                    class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                  >
                    +50
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjPoints(100)}
                    class="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjPoints(-20)}
                    class="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                  >
                    -20
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjPoints(-50)}
                    class="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                  >
                    -50
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjPoints(-100)}
                    class="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800"
                  >
                    -100
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason (Audit Trail)
                </label>
                <textarea
                  rows="3"
                  placeholder="e.g. Penalty for confirmed code sharing on Problem B"
                  value={adjReason()}
                  onInput={(e) => setAdjReason(e.currentTarget.value)}
                  class="notion-input w-full text-xs"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={adjSubmitting()}
                class="w-full py-2.5 rounded-md text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs disabled:opacity-50"
              >
                {adjSubmitting() ? 'Applying...' : 'Apply Score Adjustment'}
              </button>
            </form>
          </div>

          {/* Audit Log Table */}
          <div class="md:col-span-2 notion-card p-6 space-y-4">
            <div>
              <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100">Adjustment Audit Log</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every manual score modification is audited with admin identity and timestamp.
              </p>
            </div>

            <Show
              when={adjustments().length > 0}
              fallback={
                <div class="py-16 text-center text-xs text-slate-400 dark:text-slate-500">
                  No manual score adjustments recorded for this contest yet.
                </div>
              }
            >
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                    <tr>
                      <th class="py-2.5 px-3">Participant</th>
                      <th class="py-2.5 px-3">Points</th>
                      <th class="py-2.5 px-3">Reason</th>
                      <th class="py-2.5 px-3">Adjudicator</th>
                      <th class="py-2.5 px-3">Time</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    <For each={adjustments()}>
                      {(adj) => (
                        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td class="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                            {adj.user_name || 'Participant'}
                          </td>
                          <td class="py-2.5 px-3">
                            <span
                              class={`px-2 py-0.5 rounded font-bold ${
                                adj.points > 0
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                              }`}
                            >
                              {adj.points > 0 ? `+${adj.points}` : adj.points} pts
                            </span>
                          </td>
                          <td class="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            {adj.reason}
                          </td>
                          <td class="py-2.5 px-3 text-slate-500 dark:text-slate-400">{adj.admin_name || 'Admin'}</td>
                          <td class="py-2.5 px-3 text-slate-400">
                            {new Date(adj.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </Show>
          </div>
        </div>
      </Show>

      {/* Tab 4: Cluster & Rejudge */}
      <Show when={activeTab() === 'rejudge'}>
        <div class="notion-card p-8 max-w-2xl space-y-6">
          <div>
            <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Cluster Batch Rejudge</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Dispatch all past submissions for the selected competition across native judge workers for complete re-evaluation. Use this after modifying test cases, checker logic, or problem limits.
            </p>
          </div>

          <Show when={rejudgeMsg()}>
            {(msg) => (
              <div
                class={`p-3 rounded-md text-xs font-medium flex items-center justify-between ${
                  msg().type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                }`}
              >
                <span>{msg().text}</span>
                <button onClick={() => setRejudgeMsg(null)} class="text-current opacity-70 hover:opacity-100">
                  <IconX class="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </Show>

          <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <span class="font-bold text-slate-900 dark:text-slate-100">Target Competition:</span>{' '}
            <span>{selectedContest()?.title || 'None Selected'}</span>
          </div>

          <button
            onClick={handleTriggerRejudge}
            disabled={rejudgeRunning() || !selectedContestId()}
            class="px-5 py-2.5 rounded-md text-xs font-bold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs disabled:opacity-50 flex items-center gap-2"
          >
            <IconRefresh class={`w-3.5 h-3.5 ${rejudgeRunning() ? 'animate-spin' : ''}`} />
            <span>{rejudgeRunning() ? 'Dispatching Batch...' : 'Dispatch Contest Rejudge'}</span>
          </button>
        </div>
      </Show>

      {/* Tab 5: Squads & Teams Management */}
      <Show when={activeTab() === 'teams'}>
        <div class="space-y-6">
          <div class="notion-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Squad & Roster Management</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitor registered participant teams, examine memberships, and delete squads. Teams are also automatically deleted if all members leave.
              </p>
            </div>
            <div class="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search squad or member..."
                value={teamSearchQuery()}
                onInput={(e) => setTeamSearchQuery(e.currentTarget.value)}
                class="notion-input text-xs w-60"
              />
              <button
                onClick={fetchTeams}
                disabled={teamsLoading()}
                class="px-3 py-2 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <IconRefresh class={`w-3.5 h-3.5 ${teamsLoading() ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <Show when={teamMsg()}>
            {(msg) => (
              <div
                class={`p-3 rounded-md text-xs font-medium flex items-center justify-between ${
                  msg().type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                }`}
              >
                <span>{msg().text}</span>
                <button onClick={() => setTeamMsg(null)} class="text-current opacity-70 hover:opacity-100">
                  <IconX class="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </Show>

          <Show
            when={!teamsLoading()}
            fallback={
              <div class="p-12 text-center text-xs text-slate-500">Loading squads...</div>
            }
          >
            {(() => {
              const q = teamSearchQuery().toLowerCase().trim();
              const list = q
                ? teamsList().filter(
                    (t) =>
                      t.name.toLowerCase().includes(q) ||
                      t.members?.some((m) => m.user_name?.toLowerCase().includes(q) || m.user_email?.toLowerCase().includes(q))
                  )
                : teamsList();

              return (
                <Show
                  when={list.length > 0}
                  fallback={
                    <div class="notion-card p-12 text-center">
                      <IconUsers class="w-10 h-10 mx-auto text-slate-400 mb-3" />
                      <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">No squads found</h3>
                      <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {teamSearchQuery() ? 'No teams matched your query filter.' : 'No participant teams have been registered yet.'}
                      </p>
                    </div>
                  }
                >
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <For each={list}>
                      {(team) => (
                        <div class="notion-card p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition">
                          <div class="space-y-3">
                            <div class="flex items-start justify-between gap-2">
                              <div>
                                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">{team.name}</h3>
                                <div class="flex items-center gap-2 mt-1">
                                  <span class="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                    Code: {team.join_code}
                                  </span>
                                  <span class="text-[11px] text-slate-500 dark:text-slate-400">
                                    {team.members?.length || 0} members
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteTeam(team.id, team.name)}
                                disabled={deletingTeamId() === team.id}
                                title="Delete Squad permanently"
                                class="px-2.5 py-1.5 rounded text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-1.5 transition disabled:opacity-50"
                              >
                                <IconTrash class="w-3.5 h-3.5" />
                                <span>{deletingTeamId() === team.id ? 'Deleting...' : 'Delete Squad'}</span>
                              </button>
                            </div>

                            <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                              <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                                Squad Roster:
                              </span>
                              <div class="space-y-1.5">
                                <For each={team.members || []}>
                                  {(member) => (
                                    <div class="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-50 dark:bg-slate-800/50">
                                      <div class="flex items-center gap-2 min-w-0">
                                        <span class="font-medium text-slate-800 dark:text-slate-200 truncate">
                                          {member.user_name}
                                        </span>
                                        <Show when={member.user_email}>
                                          <span class="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                            ({member.user_email})
                                          </span>
                                        </Show>
                                      </div>
                                      <Show when={member.user_id === team.captain_id}>
                                        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                          Captain
                                        </span>
                                      </Show>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </div>
                          </div>

                          <div class="text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <span>ID: {team.id.slice(0, 8)}...</span>
                            <span>Created {new Date(team.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
              );
            })()}
          </Show>
        </div>
      </Show>

      {/* Create Competition Modal */}
      <Show when={isCreateContestOpen()}>
        <div class="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div class="notion-card w-full max-w-lg p-6 bg-white dark:bg-slate-900 shadow-xl space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 class="text-base font-bold text-slate-900 dark:text-slate-100">Create New Competition</h2>
              <button
                onClick={() => setIsCreateContestOpen(false)}
                class="text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 p-1"
              >
                <IconX class="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewContest} class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Competition Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CodeBench Grand Prix #1"
                  value={newTitle()}
                  onInput={(e) => setNewTitle(e.currentTarget.value)}
                  class="notion-input w-full"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Scoring Mode
                  </label>
                  <select
                    value={newScoring()}
                    onChange={(e) => setNewScoring(e.currentTarget.value)}
                    class="notion-input w-full text-xs"
                  >
                    <option value="icpc">ICPC (Solved + 20m Penalty)</option>
                    <option value="points">Points (Flat Points)</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="1440"
                    value={newDurationMin()}
                    onInput={(e) => setNewDurationMin(Number(e.currentTarget.value))}
                    class="notion-input w-full"
                  />
                </div>
              </div>

              <div class="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-xs font-bold text-slate-900 dark:text-slate-100">Team Competition Mode</span>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400">Allow participants to form squads with invite codes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={newIsTeam()}
                    onChange={(e) => setNewIsTeam(e.currentTarget.checked)}
                    class="w-4 h-4 text-slate-900 rounded"
                  />
                </div>

                <Show when={newIsTeam()}>
                  <div class="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <label class="text-xs font-semibold text-slate-700 dark:text-slate-300">Max Team Size:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={newMaxTeamSize()}
                      onInput={(e) => setNewMaxTeamSize(Number(e.currentTarget.value))}
                      class="notion-input w-20 text-center font-bold"
                    />
                  </div>
                </Show>
              </div>

              <div class="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                <strong>Contest Lifecycle Notice:</strong> The competition will initialize in the <strong>UPCOMING</strong> state. The arena will unlock strictly when you click <em>"Start Contest Immediately"</em> in the admin dashboard.
              </div>

              <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateContestOpen(false)}
                  class="px-4 py-2 rounded-md text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingContest() || !newTitle().trim()}
                  class="px-5 py-2 rounded-md text-xs font-bold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs disabled:opacity-50"
                >
                  {creatingContest() ? 'Creating...' : 'Create Competition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>
      {/* Markdown Problem Template Upload & Preview Modal */}
      <Show when={isUploadMDModalOpen()}>
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div class="notion-card w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div class="flex items-center gap-2">
                <IconUpload class="w-4 h-4 text-blue-500" />
                <h2 class="text-base font-bold text-slate-900 dark:text-white">Import Problem from Markdown (.md)</h2>
              </div>
              <button
                onClick={() => setIsUploadMDModalOpen(false)}
                class="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                <IconX class="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div class="p-6 space-y-4 overflow-y-auto flex-1">
              <div class="flex items-center justify-between text-xs">
                <span class="text-slate-500 dark:text-slate-400">
                  Paste raw Markdown with YAML frontmatter or upload a file. Test cases in <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">```input</code> and <code class="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">```output</code> blocks will be parsed automatically.
                </span>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <IconDownload class="w-3.5 h-3.5" />
                  <span>Download Sample .md</span>
                </button>
              </div>

              {/* Textarea for Markdown */}
              <div>
                <textarea
                  rows="10"
                  value={rawMDInput()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    setRawMDInput(val);
                    setParsedMDPreview(parseProblemMarkdown(val));
                  }}
                  placeholder="Paste problem markdown with YAML frontmatter..."
                  class="notion-input w-full font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Real-Time Parsed Validation Summary */}
              <Show when={parsedMDPreview()}>
                {(p) => (
                  <div class="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Template Parsing Analysis
                      </span>
                      <span
                        class={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          p().errors.length === 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        }`}
                      >
                        {p().errors.length === 0 ? 'Valid Template' : `${p().errors.length} Errors Found`}
                      </span>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div class="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                        <span class="text-[10px] text-slate-400 block">Title</span>
                        <span class="font-bold text-slate-900 dark:text-white truncate block">{p().title || 'Untitled'}</span>
                      </div>
                      <div class="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                        <span class="text-[10px] text-slate-400 block">Slug / Label</span>
                        <span class="font-mono text-slate-800 dark:text-slate-200 truncate block">{p().contest_label} : {p().slug}</span>
                      </div>
                      <div class="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                        <span class="text-[10px] text-slate-400 block">Limits</span>
                        <span class="font-mono text-slate-800 dark:text-slate-200 block">{p().time_limit_ms}ms / {p().memory_mb}MB</span>
                      </div>
                      <div class="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                        <span class="text-[10px] text-slate-400 block">Test Cases</span>
                        <span class="font-bold text-emerald-600 dark:text-emerald-400 block">
                          {p().sample_tests.length} Sample / {p().hidden_tests.length} Hidden
                        </span>
                      </div>
                    </div>

                    {/* Warnings & Errors */}
                    <Show when={p().errors.length > 0}>
                      <div class="p-2.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                        <For each={p().errors}>
                          {(err) => <div>&bull; {err}</div>}
                        </For>
                      </div>
                    </Show>

                    <Show when={p().warnings.length > 0}>
                      <div class="p-2.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs space-y-1">
                        <For each={p().warnings}>
                          {(warn) => <div>&bull; {warn}</div>}
                        </For>
                      </div>
                    </Show>
                  </div>
                )}
              </Show>
            </div>

            {/* Modal Actions */}
            <div class="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setIsUploadMDModalOpen(false)}
                class="px-4 py-2 rounded-md text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!parsedMDPreview() || parsedMDPreview()?.errors.length !== 0}
                  onClick={() => {
                    const p = parsedMDPreview();
                    if (p) handleApplyParsedProblem(p);
                  }}
                  class="px-4 py-2 rounded-md text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition shadow-xs disabled:opacity-50"
                >
                  Load into Studio Form
                </button>

                <button
                  type="button"
                  disabled={!parsedMDPreview() || parsedMDPreview()?.errors.length !== 0 || probSubmitting()}
                  onClick={() => {
                    const p = parsedMDPreview();
                    if (p) handleDirectPublishParsed(p);
                  }}
                  class="px-5 py-2 rounded-md text-xs font-bold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <IconCheck class="w-3.5 h-3.5 text-white" />
                  <span>{probSubmitting() ? 'Publishing...' : 'Publish to Contest Directly'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
