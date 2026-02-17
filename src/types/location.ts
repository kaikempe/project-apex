export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface LocationData extends LatLng {
  speed: number;
  heading: number | null;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
}
