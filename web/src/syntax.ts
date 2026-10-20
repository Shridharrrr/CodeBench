import Prism from 'prismjs';
import 'prismjs/components/prism-c.js';
import 'prismjs/components/prism-cpp.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-rust.js';
import 'prismjs/components/prism-go.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-markdown.js';

export function normalizeLanguage(lang: string): string {
  if (!lang) return 'text';
  const clean = lang.toLowerCase().split(/\s+/)[0].trim();
  if (clean.startsWith('cpp') || clean === 'c++' || clean === 'cxx') return 'cpp';
  if (clean.startsWith('c23') || clean === 'c') return 'c';
  if (clean.startsWith('py')) return 'python';
  if (clean.startsWith('rust') || clean === 'rs') return 'rust';
  if (clean.startsWith('go') || clean === 'golang') return 'go';
  if (clean === 'sh' || clean === 'shell') return 'bash';
  if (clean === 'yml') return 'yaml';
  if (clean === 'js' || clean === 'javascript') return 'javascript';
  if (clean === 'ts' || clean === 'typescript') return 'typescript';
  return clean;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function highlightCode(code: string, language: string): string {
  if (!code) return '';
  const lang = normalizeLanguage(language);
  const grammar = Prism.languages[lang];
  if (grammar) {
    try {
      return Prism.highlight(code, grammar, lang);
    } catch {
      return escapeHtml(code);
    }
  }
  return escapeHtml(code);
}

export default Prism;
