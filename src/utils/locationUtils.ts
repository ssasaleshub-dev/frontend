/**
 * Location utility for Enterprise Staff Attendance
 * Captures exact GPS coordinates and human-readable locality.
 */

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  placeName?: string;
  formatted: string;
}

/**
 * Captures the user's current GPS location with high speed.
 * Uses cached location and fast network positioning (maximumAge: 5 mins, timeout: 1.2s)
 * so attendance check-in is instantaneous and never hangs.
 */
export async function captureExactLocation(timeoutMs = 1200): Promise<string> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return '';
  }

  return new Promise((resolve) => {
    let resolved = false;
    const finish = (val: string) => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };

    // Hard fallback timeout so location never delays check-in
    const hardTimer = setTimeout(() => {
      finish('');
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(hardTimer);
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy || 0);
        const latFormatted = lat.toFixed(5);
        const lonFormatted = lon.toFixed(5);

        finish(`${latFormatted}, ${lonFormatted} (±${accuracy}m)`);
      },
      (err) => {
        clearTimeout(hardTimer);
        console.warn('Attendance GPS capture error / permission:', err.message);
        finish('');
      },
      {
        enableHighAccuracy: false, // Fast cellular/Wi-Fi fix without hardware satellite lag
        timeout: timeoutMs,
        maximumAge: 300000, // 5 minutes cached fix allows instant (<10ms) response
      }
    );
  });
}

/**
 * Extracts location info and coordinates from check-in notes.
 */
export function extractLocationFromNote(note?: string): {
  locationText: string;
  coords: { lat: number; lon: number } | null;
  userNote: string;
} {
  if (!note) return { locationText: '', coords: null, userNote: '' };

  const locMatch = note.match(/📍\s*([^|\n]+)/);
  if (!locMatch) {
    return { locationText: '', coords: null, userNote: note };
  }

  const locationText = locMatch[1].trim();
  const userNote = note.replace(/📍\s*[^|\n]+(\s*\|\s*)?/, '').trim();

  // Try extracting coordinates
  const coordsMatch = locationText.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  let coords = null;
  if (coordsMatch) {
    const lat = parseFloat(coordsMatch[1]);
    const lon = parseFloat(coordsMatch[2]);
    if (!isNaN(lat) && !isNaN(lon)) {
      coords = { lat, lon };
    }
  }

  return { locationText, coords, userNote };
}
