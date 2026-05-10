import { Camera } from 'lucide-react';

export function FAB({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <button className="md:hidden fixed bottom-[88px] right-6 w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center z-50 hover:scale-105 transition-transform active:scale-95">
      <Camera className="w-7 h-7" />
    </button>
  );
}
