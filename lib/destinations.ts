// Mock destination catalog for the /create-trip autocomplete.
//
// There's no real places API wired up yet (see project plan "destination
// knowledge cache" for where that would eventually live, per
// vercel-react-best-practices). This is a reasonably broad, real-world
// list of "City, Country" strings so the autocomplete has something
// honest to filter against in the meantime — swap `searchDestinations`'s
// body for a real API/DB call later without touching any caller.

export const DESTINATIONS: string[] = [
  "Amsterdam, Netherlands",
  "Athens, Greece",
  "Auckland, New Zealand",
  "Bangkok, Thailand",
  "Barcelona, Spain",
  "Beijing, China",
  "Belgrade, Serbia",
  "Berlin, Germany",
  "Bogotá, Colombia",
  "Bora Bora, French Polynesia",
  "Bordeaux, France",
  "Boston, United States",
  "Brussels, Belgium",
  "Budapest, Hungary",
  "Buenos Aires, Argentina",
  "Cairo, Egypt",
  "Cape Town, South Africa",
  "Casablanca, Morocco",
  "Chiang Mai, Thailand",
  "Chicago, United States",
  "Copenhagen, Denmark",
  "Cusco, Peru",
  "Dakar, Senegal",
  "Djerba, Tunisia",
  "Dubai, United Arab Emirates",
  "Dublin, Ireland",
  "Dubrovnik, Croatia",
  "Edinburgh, United Kingdom",
  "Florence, Italy",
  "Fez, Morocco",
  "Geneva, Switzerland",
  "Hammamet, Tunisia",
  "Hanoi, Vietnam",
  "Havana, Cuba",
  "Helsinki, Finland",
  "Ho Chi Minh City, Vietnam",
  "Hong Kong, China",
  "Istanbul, Türkiye",
  "Jaipur, India",
  "Jakarta, Indonesia",
  "Kraków, Poland",
  "Kyoto, Japan",
  "Lagos, Nigeria",
  "Lima, Peru",
  "Lisbon, Portugal",
  "Ljubljana, Slovenia",
  "London, United Kingdom",
  "Los Angeles, United States",
  "Luang Prabang, Laos",
  "Lyon, France",
  "Madrid, Spain",
  "Marrakech, Morocco",
  "Medellín, Colombia",
  "Melbourne, Australia",
  "Mexico City, Mexico",
  "Miami, United States",
  "Milan, Italy",
  "Montreal, Canada",
  "Munich, Germany",
  "Nairobi, Kenya",
  "Naples, Italy",
  "New Orleans, United States",
  "New York City, United States",
  "Oaxaca, Mexico",
  "Osaka, Japan",
  "Oslo, Norway",
  "Paris, France",
  "Porto, Portugal",
  "Prague, Czechia",
  "Queenstown, New Zealand",
  "Quito, Ecuador",
  "Reykjavík, Iceland",
  "Rio de Janeiro, Brazil",
  "Rome, Italy",
  "Rotterdam, Netherlands",
  "Salvador, Brazil",
  "San Francisco, United States",
  "San Sebastián, Spain",
  "Santiago, Chile",
  "Santorini, Greece",
  "São Paulo, Brazil",
  "Sapporo, Japan",
  "Sevilla, Spain",
  "Seoul, South Korea",
  "Shanghai, China",
  "Singapore, Singapore",
  "Sousse, Tunisia",
  "Stockholm, Sweden",
  "Sydney, Australia",
  "Taipei, Taiwan",
  "Tbilisi, Georgia",
  "Tel Aviv, Israel",
  "Tokyo, Japan",
  "Toronto, Canada",
  "Tulum, Mexico",
  "Tunis, Tunisia",
  "Ubud, Indonesia",
  "Vancouver, Canada",
  "Venice, Italy",
  "Vienna, Austria",
  "Warsaw, Poland",
  "Wellington, New Zealand",
  "Zagreb, Croatia",
  "Zanzibar City, Tanzania",
  "Zermatt, Switzerland",
  "Zurich, Switzerland",
];

/**
 * Prefix match, case-insensitive, against either the full "City, Country"
 * string or the city segment alone — so "bor" matches both "Bordeaux,
 * France" (string prefix) and "Bora Bora, French Polynesia" (also a
 * string prefix, since the city itself starts the string). Deliberately
 * NOT a substring/fuzzy search: the spec calls for prefix filtering, and
 * a "contains" match on a list this size returns too much noise for a
 * single-letter query.
 */
export function searchDestinations(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return DESTINATIONS.filter((destination) => destination.toLowerCase().startsWith(q)).slice(
    0,
    limit,
  );
}
