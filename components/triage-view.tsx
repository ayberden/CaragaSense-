'use client';
import { Filter } from 'lucide-react';
import Image from 'next/image';

const MOCK_DAMAGES = [
  {
    id: "PH-1092",
    type: "Deep Pothole",
    severity: "High",
    severityColor: "bg-error-container text-on-error-container",
    dotColor: "bg-severity-high",
    confidence: "98%",
    location: "Main St. & 4th Ave",
    image: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=200&q=80"
  },
  {
    id: "CR-881",
    type: "Surface Crack",
    severity: "Medium",
    severityColor: "bg-secondary-fixed text-on-secondary-fixed-variant",
    dotColor: "bg-severity-medium",
    confidence: "85%",
    location: "Oak Ln. Sector 2",
    image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=200&q=80"
  },
  {
    id: "FM-22",
    type: "Faded Markings",
    severity: "Low",
    severityColor: "bg-surface-container text-severity-low",
    dotColor: "bg-severity-low",
    confidence: "92%",
    location: "Hwy 9 Northbound",
    image: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=200&q=80"
  }
];

export function TriageView() {
  return (
    <div className="p-4 md:p-8 flex flex-col h-full max-w-7xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="font-headline text-3xl font-bold text-on-surface">Triage Queue</h1>
        <p className="font-sans text-lg text-on-surface-variant">Review and dispatch field operations based on AI detection confidence.</p>
      </header>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex-1">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-muted flex justify-between items-center">
          <h3 className="font-headline text-xl font-bold text-on-surface">Detection Queue</h3>
          <button className="flex items-center gap-2 text-primary text-sm hover:underline font-bold">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface font-mono text-xs uppercase tracking-widest text-on-surface-variant border-b border-outline-variant">
                <th className="px-6 py-4 font-bold">Damage Type</th>
                <th className="px-6 py-4 font-bold">Severity</th>
                <th className="px-6 py-4 font-bold">Location</th>
                <th className="px-6 py-4 font-bold">Confidence</th>
                <th className="px-6 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="font-sans text-sm">
              {MOCK_DAMAGES.map(damage => (
                <tr key={damage.id} className="border-b border-outline-variant hover:bg-surface-muted transition-colors">
                  <td className="px-6 py-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded overflow-hidden relative border border-outline-variant shrink-0">
                      <Image src={damage.image} alt={damage.type} fill className="object-cover" unoptimized referrerPolicy="no-referrer" />
                    </div>
                    <span className="font-bold text-base text-on-surface">{damage.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-bold ${damage.severityColor}`}>
                      <span className={`w-2 h-2 rounded-full ${damage.dotColor}`}></span> {damage.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-base text-on-surface-variant">{damage.location}</td>
                  <td className="px-6 py-4 text-base text-on-surface-variant font-mono">{damage.confidence}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 tracking-wide">
                      <button className="text-on-surface-variant hover:text-error font-semibold transition-colors">Dismiss</button>
                      <button className="bg-primary text-on-primary px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity">Dispatch</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex flex-col gap-4 pb-16">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-headline text-lg font-bold text-on-surface">Detection Queue</h3>
          <button className="text-primary text-sm font-bold flex items-center gap-1">
             <Filter className="w-4 h-4"/> Filter
          </button>
        </div>
        {MOCK_DAMAGES.map(damage => (
          <div key={damage.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="h-32 w-full relative">
               <Image src={damage.image} alt={damage.type} fill className="object-cover" unoptimized referrerPolicy="no-referrer" />
               <div className="absolute top-2 left-2">
                 <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded shadow text-[10px] font-mono font-bold ${damage.severityColor}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${damage.dotColor}`}></span> {damage.severity}
                 </span>
               </div>
            </div>
            <div className="p-4 flex flex-col">
              <div className="flex justify-between items-start mb-1">
                <h4 className="font-bold text-lg text-on-surface">{damage.type}</h4>
                <span className="font-mono text-xs text-primary font-bold bg-primary-container/20 px-2 py-1 rounded">{damage.confidence}</span>
              </div>
              <p className="text-sm text-on-surface-variant mb-4">{damage.location}</p>
              
              <div className="flex gap-2">
                <button className="flex-1 bg-surface-container-high text-on-surface py-2 rounded-lg font-semibold text-sm transition-colors active:bg-surface-variant">Dismiss</button>
                <button className="flex-1 bg-primary text-on-primary py-2 rounded-lg font-semibold text-sm transition-colors active:scale-95 shadow-sm">Dispatch</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
