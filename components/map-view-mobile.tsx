import { MapView } from './map-view';

export function MapViewMobile() {
  return (
    <div className="h-[calc(100vh-140px)] w-full p-4 flex flex-col md:hidden">
      <MapView />
    </div>
  );
}
