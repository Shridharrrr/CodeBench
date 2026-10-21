import { createMemo } from 'solid-js';
import { marked } from 'marked';
import { highlightCode } from './syntax';

interface MarkdownViewProps {
  content: string;
  class?: string;
}

// Format basic math tokens without heavy external mathjax
function formatMathSymbols(str: string): string {
  return str
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\ne/g, '≠')
    .replace(/\\times/g, '×')
    .replace(/\\approx/g, '≈')
    .replace(/\\dots/g, '…')
    .replace(/\\in/g, '∈')
    .replace(/\\to/g, '→')
    .replace(/\\infty/g, '∞')
    .replace(/\\pm/g, '±');
}

// Configure custom marked renderer with Prism syntax highlighting
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    code(token: any) {
      const rawLang = token.lang ? token.lang.trim().split(/\s+/)[0] : 'text';
      const lang = rawLang || 'text';
      const highlighted = highlightCode(token.text, lang);
      return `<div class="relative group my-3 rounded-none overflow-hidden border border-neutral-300 dark:border-neutral-800">
        <div class="flex items-center justify-between px-3 py-1 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-800 text-[10px] text-neutral-500 dark:text-neutral-400 font-bold uppercase tracking-wider select-none">
          <span>${lang}</span>
        </div>
        <pre class="language-${lang} p-3 overflow-x-auto text-xs bg-neutral-50 dark:bg-neutral-950 font-mono text-neutral-900 dark:text-neutral-100 leading-relaxed m-0"><code class="language-${lang}">${highlighted}</code></pre>
      </div>`;
    }
  }
});

export function renderProblemMarkdown(raw: string): string {
  if (!raw) return '';

  // Transform inline math $...$
  const transformed = raw.replace(/\$([^$]+)\$/g, (_, math) => {
    const formatted = formatMathSymbols(math);
    return `<span class="math-expr font-serif italic px-0.5 text-neutral-900 dark:text-neutral-100 font-semibold">${formatted}</span>`;
  });

  return marked.parse(transformed) as string;
}

export default function MarkdownView(props: MarkdownViewProps) {
  const html = createMemo(() => renderProblemMarkdown(props.content));

  return (
    <div
      class={`problem-prose text-slate-700 dark:text-slate-200 text-xs leading-relaxed space-y-3 ${props.class || ''}`}
      innerHTML={html()}
    />
  );
}
