// ─────────────────────────────────────────────────────────────
//  Edit everything about the invitation here. No other file
//  needs to change for names, dates, places or wording.
// ─────────────────────────────────────────────────────────────
window.WEDDING = {
  couple: {
    partner1: "Ahmed Adel",
    partner2: "Lamia Osama",
  },

  tagline: "Two hearts, one beautiful beginning",
  invitationLine: "Invite you to celebrate the beginning of their forever",
  closingLine: "Your presence will complete our happiness",

  // Date & time with Cairo's UTC offset (+02:00 in November), so the
  // countdown and calendar are right for guests in any time zone.
  start: "2026-11-11T19:00+02:00",
  end: "2026-11-11T23:00+02:00",
  dateText: "11 • 11 • 2026",
  dayText: "Wednesday",
  timeText: "7:00 PM – 11:00 PM",
  // What the three scratch-off hearts reveal
  dateParts: ["11", "Nov", "2026"],
  dateLabels: ["Day", "Month", "Year"],

  // Soft music-box melody that starts when the envelope opens (guests can pause it)
  music: true,

  venue: {
    name: "Talinda Hall",
    place: "Amira Valley",
    address: "Amira Valley for Weddings, Saqqara Tourist Road, opposite Cataract Hotel, Giza, Egypt",
    addressAr: "وادي الاميرة للحفلات - طريق سقارة السياحي - امام فندق كتاراكت، الجيزة",
    mapUrl: "https://www.google.com/maps/search/?api=1&query=Amira+Valley+For+Wedding+Saqqara+Road+Giza",
    photos: [
      "assets/venue-1.jpg",
      "assets/venue-2.jpg",
      "assets/venue-3.jpg",
      "assets/venue-4.jpg",
      "assets/venue-5.jpg",
      "assets/venue-6.jpg",
    ],
  },

  // RSVP — the section stays hidden until at least one of these is filled in.
  rsvp: {
    deadlineText: "",          // e.g. "Kindly reply by the 1st of November"
    whatsapp: "",              // e.g. "201001234567" (country code, no + or spaces)
    email: "",                 // e.g. "ahmed.lamia@example.com"
    formEndpoint: "",          // optional Formspree endpoint to collect replies online
  },
};
