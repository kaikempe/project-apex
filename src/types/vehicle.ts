export interface Vehicle {
  id: string;
  owner_id: string;
  name: string;              // e.g., "BMW M3"
  bt_mac?: string;           // Bluetooth MAC (optional)
  specs: VehicleSpecs;
  created_at: string;
  is_active: boolean;        // Currently selected vehicle
}

export interface VehicleSpecs {
  make: string;              // e.g., "BMW"
  model: string;             // e.g., "M3 Competition"
  year: number;              // e.g., 2023
  power_hp: number;          // e.g., 503
  torque_nm?: number;        // e.g., 650 (Newton-meters)
  weight_kg: number;         // e.g., 1730
  drivetrain: 'RWD' | 'FWD' | 'AWD';
  color?: string;            // e.g., "#1C69D4" (BMW blue)
  image_url?: string;        // Optional vehicle image
}

export interface DriveSession {
  id: string;
  user_id: string;
  vehicle_id: string;
  start_time: string;
  end_time?: string;
  distance_km: number;
  max_speed_kmh: number;
}
