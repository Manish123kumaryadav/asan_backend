const cache = new Map();
const CACHE_TIME = 24 * 60 * 60 * 1000;

function addressLabel(data, latitude, longitude) {
  const address = data?.address || {};
  const parts = [
    address.neighbourhood || address.suburb || address.road,
    address.city || address.town || address.village || address.county,
    address.state,
    address.postcode,
  ].filter((part, index, values) => part && values.indexOf(part) === index);
  return parts.length ? parts.join(", ") : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

exports.reverse = async (req, res) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lon);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, message: "Valid latitude and longitude are required" });
    }

    const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.updatedAt < CACHE_TIME) return res.json({ success: true, data: cached });

    const params = new URLSearchParams({ format: "jsonv2", lat: String(latitude), lon: String(longitude), addressdetails: "1", zoom: "18" });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { "User-Agent": "Aashanway/1.0 (https://asanway.up.railway.app)", "Accept-Language": req.headers["accept-language"] || "en-IN" },
    });
    if (!response.ok) throw new Error("Address lookup is temporarily unavailable");
    const result = { label: addressLabel(await response.json(), latitude, longitude), latitude, longitude, updatedAt: Date.now() };
    cache.set(key, result);
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(502).json({ success: false, message: error.message });
  }
};
