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
 * Captures the user's current GPS location with high accuracy.
 * Attempts quick reverse-geocoding to resolve locality / city.
 * Returns a formatted string e.g. "Namakkal, Tamil Nadu (11.21890, 78.16740)"
 */
export async function captureExactLocation(): Promise<string> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return '';
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const accuracy = Math.round(position.coords.accuracy || 0);

        let placeName = '';
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 2500);

          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
            { signal: controller.signal }
          );
          clearTimeout(timer);

          if (res.ok) {
            const data = await res.json();
            const addr = data?.address || {};
            const suburb =
              addr.suburb ||
              addr.neighbourhood ||
              addr.city_district ||
              addr.village ||
              addr.road ||
              '';
            const city =
              addr.city ||
              addr.town ||
              addr.county ||
              addr.state_district ||
              addr.state ||
              '';
            placeName = [suburb, city].filter(Boolean).join(', ');
          }
        } catch {
          // Graceful fallback to raw coordinates
        }

        const latFormatted = lat.toFixed(5);
        const lonFormatted = lon.toFixed(5);

        if (placeName) {
          resolve(`${placeName} (${latFormatted}, ${lonFormatted})`);
        } else {
          resolve(`${latFormatted}, ${lonFormatted} (±${accuracy}m)`);
        }
      },
      (err) => {
        console.warn('Attendance GPS capture error / permission denied:', err.message);
        resolve('');
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 30000,
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
