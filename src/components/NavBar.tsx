/**
 * Bottom navigation.
 *
 * Four flat tabs, no centre button: Today, Library, Insights, Settings.
 * Workout is a page rather than a tab. It opens from Library, and Today shows
 * a resume card while a session is running, so nothing is stranded.
 */

type NavPage = 'today' | 'library' | 'insights' | 'settings';

interface NavBarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
}

const ICONS: Record<NavPage, string> = {
  today: 'M12 7.5V12l3 2',
  insights: 'M4 19V9M10 19V5M16 19v-7M22 19H3',
  library: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
};

const LABELS: Record<NavPage, string> = {
  today: 'Today',
  library: 'Library',
  insights: 'Insights',
  settings: 'Settings',
};

const ORDER: NavPage[] = ['today', 'library', 'insights', 'settings'];

export function NavBar({ currentPage, onNavigate }: NavBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {ORDER.map(page => {
          const isActive = currentPage === page;
          const tint = isActive
            ? 'text-slate-800 dark:text-slate-100'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200';

          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${tint}`}
            >
              <span className="relative flex items-center justify-center w-[30px] h-[30px]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {page === 'today' && <circle cx="12" cy="12" r="9" strokeWidth={isActive ? 2.5 : 2} />}
                  <path strokeLinecap="round" strokeLinejoin="round"
                    strokeWidth={isActive ? 2.5 : 2} d={ICONS[page]} />
                  {page === 'settings' && (
                    <path strokeLinecap="round" strokeLinejoin="round"
                      strokeWidth={isActive ? 2.5 : 2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  )}
                </svg>
              </span>
              <span className={`text-xs ${isActive ? 'font-medium' : ''}`}>{LABELS[page]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
