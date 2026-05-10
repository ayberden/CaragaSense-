export function AlertsView() {
  return (
    <div className="p-4 md:p-8 flex flex-col h-full max-w-7xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="font-headline text-3xl font-bold text-on-surface">Alerts & Notifications</h1>
        <p className="font-sans text-lg text-on-surface-variant">Review critical road damage reports and system updates.</p>
      </header>
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 shadow-sm flex-1 flex flex-col items-center justify-center text-center">
         <h2 className="text-xl font-bold mb-2">No new alerts</h2>
         <p className="text-on-surface-variant">System is running optimally with no critical notifications.</p>
      </div>
    </div>
  );
}
