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
    { key: 'C', desc: 'Toggle Retro CRT Scanline Overlay' },
    { key: '?', desc: 'Toggle Keyboard Shortcuts Modal' },
    { key: 'Esc', desc: 'Dismiss Active Modal or Flyout' },
  ];

  return (
    <Show when={props.isOpen}>
      <div class="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
        <div class="notion-card w-full max-w-md p-5 bg-white dark:bg-[#111316] border border-[#d4d6dc] dark:border-[#272b34] rounded-[2px] shadow-[4px_4px_0px_rgba(0,0,0,0.3)] space-y-4">
          <div class="flex items-center justify-between pb-2.5 border-b border-[#eaecf0] dark:border-[#222630]">
            <div class="flex items-center gap-2">
              <IconKeyboard class="w-4 h-4 text-blue-500" />
              <h2 class="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">
                Workstation Keyboard Accelerators
              </h2>
            </div>
            <button
              onClick={props.onClose}
              class="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
            >
              <IconX class="w-4 h-4" />
            </button>
          </div>

          <div class="space-y-1.5 font-mono text-xs">
            <For each={shortcuts}>
              {(s) => (
                <div class="flex items-center justify-between p-1.5 rounded-[2px] hover:bg-[#f4f5f7] dark:hover:bg-[#171922] transition">
                  <span class="text-zinc-600 dark:text-zinc-400 font-sans text-xs">{s.desc}</span>
                  <kbd class="px-2 py-0.5 bg-[#eaedf1] dark:bg-[#1f232d] text-zinc-800 dark:text-zinc-200 border border-[#d4d6dc] dark:border-[#2e3442] rounded-[2px] text-[11px] font-bold shadow-[1px_1px_0px_rgba(0,0,0,0.1)]">
                    {s.key}
                  </kbd>
                </div>
              )}
            </For>
          </div>

          <div class="pt-2 border-t border-[#eaecf0] dark:border-[#222630] text-[11px] text-zinc-500 dark:text-zinc-400 text-center font-sans">
            Global accelerators active across all workstation views.
          </div>
        </div>
      </div>
    </Show>
  );
}
