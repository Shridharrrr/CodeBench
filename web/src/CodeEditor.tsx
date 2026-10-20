import { createMemo } from 'solid-js';
import { highlightCode } from './syntax';

interface CodeEditorProps {
  value: string;
  onInput: (value: string) => void;
  language: string;
  placeholder?: string;
  class?: string;
}

const PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
};

const CLOSING_CHARS = new Set([')', ']', '}', '"', "'", '`']);

export default function CodeEditor(props: CodeEditorProps) {
  let textareaRef: HTMLTextAreaElement | undefined;
  let highlightRef: HTMLPreElement | undefined;
  let gutterRef: HTMLDivElement | undefined;

  const highlightedHtml = createMemo(() => {
    const val = props.value || '';
    const code = val.endsWith('\n') ? val + ' ' : val;
    return highlightCode(code, props.language);
  });

  const lines = createMemo(() => {
    const val = props.value || '';
    const count = Math.max(1, val.split('\n').length);
    return Array.from({ length: count }, (_, i) => i + 1);
  });

  const handleScroll = () => {
    if (!textareaRef) return;
    if (highlightRef) {
      highlightRef.scrollTop = textareaRef.scrollTop;
      highlightRef.scrollLeft = textareaRef.scrollLeft;
    }
    if (gutterRef) {
      gutterRef.scrollTop = textareaRef.scrollTop;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!textareaRef) return;

    const start = textareaRef.selectionStart;
    const end = textareaRef.selectionEnd;
    const val = props.value || '';

    const updateEditorValueAndCursor = (newVal: string, cursorPos: number, endPos?: number) => {
      if (!textareaRef) return;
      textareaRef.value = newVal;
      textareaRef.selectionStart = cursorPos;
      textareaRef.selectionEnd = endPos ?? cursorPos;
      props.onInput(newVal);
      requestAnimationFrame(() => {
        if (textareaRef) {
          textareaRef.selectionStart = cursorPos;
          textareaRef.selectionEnd = endPos ?? cursorPos;
        }
      });
    };

    // 1. Tab Indentation (2 spaces)
    if (e.key === 'Tab') {
      e.preventDefault();
      const tabStr = '  ';

      if (e.shiftKey) {
        // Shift+Tab: outdent current line
        const lastNewline = val.lastIndexOf('\n', start - 1);
        const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
        if (val.substring(lineStart, lineStart + 2) === '  ') {
          const newVal = val.substring(0, lineStart) + val.substring(lineStart + 2);
          updateEditorValueAndCursor(newVal, Math.max(lineStart, start - 2));
        }
      } else {
        const newVal = val.substring(0, start) + tabStr + val.substring(end);
        updateEditorValueAndCursor(newVal, start + tabStr.length);
      }
      return;
    }

    // 2. Over-typing closing bracket or quote
    if (start === end && CLOSING_CHARS.has(e.key) && val[start] === e.key) {
      if (e.key === '"' || e.key === "'" || e.key === '`') {
        if (start > 0 && val[start - 1] === '\\') {
          // allow escaped quote
        } else {
          e.preventDefault();
          textareaRef.selectionStart = textareaRef.selectionEnd = start + 1;
          return;
        }
      } else {
        e.preventDefault();
        textareaRef.selectionStart = textareaRef.selectionEnd = start + 1;
        return;
      }
    }

    // 3. Auto-closing pairs: (), [], {}, "", '', ``
    if (PAIRS[e.key]) {
      const openChar = e.key;
      const closeChar = PAIRS[e.key];

      e.preventDefault();

      if (start !== end) {
        // Wrap selected text: e.g. select 'foo' and press '(' -> '(foo)'
        const selected = val.substring(start, end);
        const newVal = val.substring(0, start) + openChar + selected + closeChar + val.substring(end);
        updateEditorValueAndCursor(newVal, start + 1, end + 1);
      } else {
        // Insert pair and place cursor between
        const newVal = val.substring(0, start) + openChar + closeChar + val.substring(end);
        updateEditorValueAndCursor(newVal, start + 1);
      }
      return;
    }

    // 4. Backspace deletion of empty pair
    if (e.key === 'Backspace' && start === end && start > 0) {
      const prevChar = val[start - 1];
      const nextChar = val[start];
      if (PAIRS[prevChar] && PAIRS[prevChar] === nextChar) {
        e.preventDefault();
        const newVal = val.substring(0, start - 1) + val.substring(start + 1);
        updateEditorValueAndCursor(newVal, start - 1);
        return;
      }
    }

    // 5. Smart Enter key (auto-indentation & expanding braces)
    if (e.key === 'Enter' && start === end) {
      // Find current line indentation
      const lastNewline = val.lastIndexOf('\n', start - 1);
      const currentLine = val.substring(lastNewline === -1 ? 0 : lastNewline + 1, start);
      const indentMatch = currentLine.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '';

      // Check if cursor is directly between braces: {|}
      if (start > 0 && val[start - 1] === '{' && val[start] === '}') {
        e.preventDefault();
        const tab = '  ';
        const insertText = '\n' + baseIndent + tab + '\n' + baseIndent;
        const newVal = val.substring(0, start) + insertText + val.substring(start);
        updateEditorValueAndCursor(newVal, start + 1 + baseIndent.length + tab.length);
        return;
      }

      // Normal enter with preserved indentation (and +1 level if ending with '{' or ':')
      if (baseIndent.length > 0 || (start > 0 && val[start - 1] === '{')) {
        e.preventDefault();
        const extraIndent = (start > 0 && (val[start - 1] === '{' || val[start - 1] === ':')) ? '  ' : '';
        const insertText = '\n' + baseIndent + extraIndent;
        const newVal = val.substring(0, start) + insertText + val.substring(end);
        updateEditorValueAndCursor(newVal, start + insertText.length);
        return;
      }
    }
  };

  return (
    <div class={`code-editor-root bg-white dark:bg-black border border-slate-200 dark:border-slate-800 ${props.class || ''}`}>
      {/* Line Numbers Gutter */}
      <div ref={gutterRef} class="code-editor-gutter font-mono overflow-hidden">
        {lines().map((n) => (
          <div class="h-6 leading-6 select-none">{n}</div>
        ))}
      </div>

      {/* Code Surface (Highlight overlay + Transparent textarea) */}
      <div class="code-editor-surface flex-1 h-full relative overflow-hidden">
        <pre
          ref={highlightRef}
          aria-hidden="true"
          class={`code-editor-highlight language-${props.language} font-mono`}
        >
          <code innerHTML={highlightedHtml()} />
        </pre>

        <textarea
          ref={textareaRef}
          value={props.value}
          onInput={(e) => props.onInput(e.currentTarget.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder || 'Write your solution here...'}
          spellcheck={false}
          autocapitalize="off"
          autocomplete="off"
          class="code-editor-textarea font-mono"
        />
      </div>
    </div>
  );
}
