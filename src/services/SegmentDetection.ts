import { LatLng } from '../types/location';

export interface Segment {
  id: string;
  name: string;
  startGate: SegmentGate;
  endGate: SegmentGate;
  distance_meters: number;
  leaderboard: SegmentRecord[];
  ghost?: GhostData;
}

export interface SegmentGate {
  latitude: number;
  longitude: number;
  radius_meters: number; // Geofence radius
}

export interface SegmentRecord {
  user_id: string;
  user_name: string;
  time_seconds: number;
  avg_speed_kmh: number;
  top_speed_kmh: number;
  date: string;
  rank: number;
}

export interface GhostData {
  user_name: string;
  time_seconds: number;
  waypoints: GhostWaypoint[];
}

export interface GhostWaypoint {
  latitude: number;
  longitude: number;
  elapsed_seconds: number;
  speed_kmh: number;
}

export interface ActiveSegmentRun {
  segment: Segment;
  startTime: number;
  startLocation: LatLng;
  waypoints: GhostWaypoint[];
  ghostIndex: number; // Current position in ghost waypoints
}

class SegmentDetectionService {
  private activeRun: ActiveSegmentRun | null = null;
  private nearbySegments: Segment[] = [];

  /**
   * Calculate distance between two coordinates in meters
   */
  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Check if location is within a gate's geofence
   */
  private isInGate(location: LatLng, gate: SegmentGate): boolean {
    const distance = this.getDistance(
      location.latitude,
      location.longitude,
      gate.latitude,
      gate.longitude
    );
    return distance <= gate.radius_meters;
  }

  /**
   * Update nearby segments based on current location
   */
  public updateNearbySegments(location: LatLng, allSegments: Segment[]) {
    this.nearbySegments = allSegments.filter((segment) => {
      const distanceToStart = this.getDistance(
        location.latitude,
        location.longitude,
        segment.startGate.latitude,
        segment.startGate.longitude
      );
      return distanceToStart <= 500; // Within 500m of start gate
    });
  }

  /**
   * Check segment entry/exit
   * Returns: 'entered', 'completed', or null
   */
  public checkSegmentTrigger(
    location: LatLng,
    speed: number,
    timestamp: number
  ): {
    event: 'entered' | 'completed' | null;
    segment?: Segment;
    time?: number;
    deltaTime?: number;
  } {
    // Check if entering a segment
    if (!this.activeRun) {
      for (const segment of this.nearbySegments) {
        if (this.isInGate(location, segment.startGate)) {
          // Start segment run
          this.activeRun = {
            segment,
            startTime: timestamp,
            startLocation: location,
            waypoints: [
              {
                latitude: location.latitude,
                longitude: location.longitude,
                elapsed_seconds: 0,
                speed_kmh: speed,
              },
            ],
            ghostIndex: 0,
          };

          console.log(`🏁 Entered segment: ${segment.name}`);
          return { event: 'entered', segment };
        }
      }
      return { event: null };
    }

    // Check if completing the active segment
    if (this.isInGate(location, this.activeRun.segment.endGate)) {
      const elapsedTime = (timestamp - this.activeRun.startTime) / 1000; // Convert to seconds
      const segment = this.activeRun.segment;

      // Calculate delta vs ghost
      const ghostTime = segment.ghost?.time_seconds || 0;
      const deltaTime = elapsedTime - ghostTime;

      console.log(`🏁 Completed segment: ${segment.name} in ${elapsedTime.toFixed(2)}s`);
      console.log(`👻 Delta vs ghost: ${deltaTime > 0 ? '+' : ''}${deltaTime.toFixed(2)}s`);

      // Clear active run
      this.activeRun = null;

      return {
        event: 'completed',
        segment,
        time: elapsedTime,
        deltaTime,
      };
    }

    // Record waypoint for active run
    if (this.activeRun) {
      const elapsedSeconds = (timestamp - this.activeRun.startTime) / 1000;
      this.activeRun.waypoints.push({
        latitude: location.latitude,
        longitude: location.longitude,
        elapsed_seconds: elapsedSeconds,
        speed_kmh: speed,
      });
    }

    return { event: null };
  }

  /**
   * Get delta time vs ghost at current position
   */
  public getGhostDelta(timestamp: number): number | null {
    if (!this.activeRun || !this.activeRun.segment.ghost) {
      return null;
    }

    const elapsedSeconds = (timestamp - this.activeRun.startTime) / 1000;
    const ghost = this.activeRun.segment.ghost;

    // Find closest ghost waypoint
    const ghostWaypoint = ghost.waypoints.find(
      (wp) => Math.abs(wp.elapsed_seconds - elapsedSeconds) < 1
    );

    if (!ghostWaypoint) {
      return null;
    }

    return elapsedSeconds - ghostWaypoint.elapsed_seconds;
  }

  /**
   * Clear active segment run
   */
  public clearActiveRun() {
    this.activeRun = null;
  }

  /**
   * Get current active segment
   */
  public getActiveSegment(): Segment | null {
    return this.activeRun?.segment || null;
  }
}

export const segmentDetection = new SegmentDetectionService();
