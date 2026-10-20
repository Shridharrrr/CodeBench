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
      return `<div class="relative group my-3 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div class="flex items-center justify-between px-3 py-1 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider select-none">
          <span>${lang}</span>
        </div>
        <pre class="language-${lang} p-3 overflow-x-auto text-xs bg-slate-50 dark:bg-[#070a10] font-mono text-slate-900 dark:text-slate-100 leading-relaxed m-0"><code class="language-${lang}">${highlighted}</code></pre>
      </div>`;
    }
  }
});

export function renderProblemMarkdown(raw: string): string {
  if (!raw) return '';

  // Transform inline math $...$
  const transformed = raw.replace(/\$([^$]+)\$/g, (_, math) => {
    const formatted = formatMathSymbols(math);
    return `<span class="math-expr font-serif italic px-0.5 text-slate-900 dark:text-blue-300 font-semibold">${formatted}</span>`;
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
