// ─────────────────────────────────────────────────────────────
//  Edit everything about the invitation here. No other file
//  needs to change for names, dates, places or wording.
// ─────────────────────────────────────────────────────────────
window.WEDDING = {
  couple: {
    partner1: "Amira",
    partner2: "Youssef",
  },

  // Local date & time of the ceremony (YYYY-MM-DDTHH:MM)
  date: "2027-06-12T16:00",
  dateText: "Saturday, the twelfth of June",
  yearText: "Two thousand twenty-seven",
  city: "Alexandria, Egypt",

  invitationLine:
    "Together with their families, request the pleasure of your company at the celebration of their marriage",

  story: {
    title: "Our Story",
    text:
      "We met on a rainy afternoon in a tiny bookshop, both reaching for the same last copy. " +
      "Years of coffee dates, long walks and shared playlists later, we can't wait to start forever — " +
      "and we would love for you to be there.",
  },

  schedule: [
    { time: "4:00 PM", title: "Ceremony", note: "Garden terrace" },
    { time: "5:30 PM", title: "Cocktail Hour", note: "Drinks & canapés by the sea" },
    { time: "7:00 PM", title: "Dinner", note: "Grand ballroom" },
    { time: "9:00 PM", title: "Dancing", note: "Until the stars go out" },
  ],

  venue: {
    name: "The Seaside Gardens",
    address: "Corniche Road, Alexandria, Egypt",
    mapUrl: "https://maps.google.com/?q=Corniche+Road+Alexandria",
  },

  dressCode: {
    title: "Dress Code",
    text: "Garden formal — soft pastels warmly welcomed. Comfortable shoes for dancing on the lawn!",
  },

  rsvp: {
    deadlineText: "Kindly reply by the first of May",
    // Option A: paste a Formspree (https://formspree.io) endpoint to collect replies online.
    formEndpoint: "",
    // Option B (used when formEndpoint is empty): replies open the guest's email app.
    email: "rsvp@example.com",
  },

  closingLine: "With love & gratitude",
};
