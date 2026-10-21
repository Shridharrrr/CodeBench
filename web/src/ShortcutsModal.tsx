import { Show, For } from 'solid-js';
import { IconX, IconKeyboard } from './icons';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsModal(props: ShortcutsModalProps) {
  const shortcuts = [
    { key: '1', desc: 'Jump to Home / Overview' },
    { key: '2', desc: 'Jump to Contest Arena' },
    { key: '3', desc: 'Jump to Squad Management' },
    { key: '4', desc: 'Jump to Live Scoreboard' },
    { key: '5', desc: 'Jump to Admin Dashboard (Admins)' },
    { key: 'T', desc: 'Toggle Dark / Light Theme' },
    { key: '?', desc: 'Toggle Keyboard Shortcuts Modal' },
    { key: 'Esc', desc: 'Dismiss Active Modal or Flyout' },
  ];

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="w-full max-w-md p-6 bg-white dark:bg-[#09090b] border border-neutral-300 dark:border-neutral-800 shadow-2xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
            <div class="flex items-center gap-2">
              <IconKeyboard class="w-4 h-4 text-neutral-700 dark:text-neutral-300" />
              <h2 class="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                Keyboard Shortcuts
              </h2>
            </div>
            <button
              onClick={props.onClose}
              class="p-1 text-neutral-400 hover:text-black dark:hover:text-white transition"
            >
              <IconX class="w-4 h-4" />
            </button>
          </div>

          <div class="space-y-1 text-xs">
            <For each={shortcuts}>
              {(s) => (
                <div class="flex items-center justify-between p-2 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition">
                  <span class="text-neutral-600 dark:text-neutral-400 font-medium">{s.desc}</span>
                  <kbd class="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold">
                    {s.key}
                  </kbd>
                </div>
              )}
            </For>
          </div>

          <div class="pt-2 border-t border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500 text-center">
            Global keyboard shortcuts active across all views.
          </div>
        </div>
      </div>
    </Show>
  );
}
