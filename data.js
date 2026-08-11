// ---------------------------------------------------------------------------
// Holiday 2026 — trip data
// Edit STAYS to correct dates/locations. Edit OPTIONS to add/remove activities.
// Everything else in the app is driven off this file.
// ---------------------------------------------------------------------------

const TRIP = {
  name: "Holiday 2026",
  travelers: "Bram & partner (+ little one, 2y)",
  start: "2026-08-24",
  end: "2026-09-11",
};

// Each stay = one accommodation block. `confirmed` marks whether it's a real
// booking (from your inbox) or a placeholder you still need to fill in.
const STAYS = [
  {
    id: "ehrwald",
    name: "Romantik Hotel Spielmann",
    place: "Ehrwald, Tyrol, Austria",
    region: "tyrol",
    address: "Wettersteinstraße 24, 6632 Ehrwald, Austria",
    checkIn: "2026-08-24",
    checkOut: "2026-08-27",
    confirmed: true,
    notes: "Suite Family South, half-board. Booking DSRAF5H00MGGV.",
  },
  {
    id: "heiligenblut",
    name: "Hieserhof – Superior Alpine Apartments",
    place: "Heiligenblut, Carinthia, Austria",
    region: "carinthia",
    address: "Hof 15, 9844 Heiligenblut, Austria",
    checkIn: "2026-08-27",
    checkOut: "2026-09-02",
    confirmed: true,
    notes: "Host Hermann Tribuser, +43 699 18104804. Kitchen fully equipped.",
  },
  {
    id: "istria",
    name: "Villa-Osmium",
    place: "Smoljanci, Svetvinčenat, Istria, Croatia",
    region: "istria",
    address: "73 Smoljanci, 52342 Smoljanci (Svetvinčenat), Croatia",
    checkIn: "2026-09-02",
    checkOut: "2026-09-09",
    confirmed: true,
    notes: "Booking 6048311160. Baby bed & high chair arranged with host.",
  },
  {
    id: "drivehome",
    name: "Drive home (not booked yet)",
    place: "Route back to Vught, Netherlands",
    region: "travel",
    address: "",
    checkIn: "2026-09-09",
    checkOut: "2026-09-11",
    confirmed: false,
    notes:
      "No hotel booked yet. ~1,300km / 13-14h driving total. Suggested 1-stop split below — add your own stop in Settings once booked.",
  },
];

// Suggested (unbooked) overnight stop for the drive home — editable/removable
// in the app. Roughly midpoint, on-route via Slovenia/Austria/Germany.
const SUGGESTED_STOPOVERS = [
  {
    name: "Salzburg area, Austria",
    why: "~750km from Istria, ~600km left to Vught the next day. Easy motorway access, plenty of family-friendly overnight stops.",
  },
  {
    name: "Nuremberg area, Germany",
    why: "Slightly further (~850km from Istria) but splits day 2 shorter (~500km), and breaks up the drive with a historic old town if you want to stretch legs.",
  },
];

// ---------------------------------------------------------------------------
// Curated options per region. Each option is scored against the day's
// question-flow answers to produce the "top choices" for that day.
//
// tags:
//   category: nature | water | culture | food | adventure | chill
//   effort:   low | medium | high
//   weather:  sunny | any | indoor  (best-suited conditions)
//   toddler:  true/false — safe & manageable with a 2-year-old
//   duration: approx hours
// ---------------------------------------------------------------------------

const OPTIONS = {
  tyrol: [
    {
      id: "ty-ehrwalder-alm",
      title: "Ehrwalder Alm gondola + alpine meadow",
      desc: "Easy gondola ride to 1,500m, flat meadow trails, playground, trampolines and go-karts right at the top station. Ehrwalder Alm inn for Tirolean lunch with a view.",
      category: "nature",
      effort: "low",
      weather: "sunny",
      toddler: true,
      duration: 3,
    },
    {
      id: "ty-wassererlebnisweg",
      title: "Wassererlebnisweg Zugspitzi (water trail)",
      desc: "Flat, free, stroller-friendly water-play trail starting right at the Ehrwalder Alm cable car station — streams, pumps and splash spots kids love.",
      category: "water",
      effort: "low",
      weather: "sunny",
      toddler: true,
      duration: 1.5,
    },
    {
      id: "ty-blindsee",
      title: "Blindsee mountain lake",
      desc: "Turquoise forest lake reachable via a short forest-road walk (€4 entry). Swimming, a pebble beach, and a scenic loop for an evening stroll.",
      category: "water",
      effort: "low",
      weather: "sunny",
      toddler: true,
      duration: 2.5,
    },
    {
      id: "ty-heiterwangersee",
      title: "Heiterwanger See boat & paddle day",
      desc: "Bigger recreational lake: rowboat/paddleboard rental, hop-on-hop-off boat tours, shaded lakeside paths — easy to keep a toddler entertained lakeside.",
      category: "water",
      effort: "low",
      weather: "sunny",
      toddler: true,
      duration: 3,
    },
    {
      id: "ty-zugspitze",
      title: "Zugspitzbahn to the summit (2,962m)",
      desc: "10-minute cable car to Germany's/Austria's highest point — glass floor platform, snow chamber, 4-country panorama. Big-weather-window activity, less toddler nap-friendly.",
      category: "adventure",
      effort: "medium",
      weather: "sunny",
      toddler: false,
      duration: 4,
    },
    {
      id: "ty-seebensee",
      title: "Seebensee lake hike",
      desc: "5.5km round trip (~90 min each way) through meadow and forest to a striking alpine lake below the Drachenkopf cliffs. Doable with a hiking carrier, not a stroller.",
      category: "nature",
      effort: "high",
      weather: "sunny",
      toddler: false,
      duration: 4,
    },
    {
      id: "ty-bichlbach-park",
      title: "Bichlbach Adventure Park",
      desc: "Rope courses, zip-lining and a 90m Flying Fox for grown-ups, plus mini-golf, kids' rafting and a natural swimming lake for the little one.",
      category: "adventure",
      effort: "medium",
      weather: "sunny",
      toddler: true,
      duration: 4,
    },
    {
      id: "ty-gamsalm",
      title: "Gamsalm mountain hut lunch",
      desc: "Sunny terrace hut with proper local food (don't skip the Kaiserschmarrn) and a kids' playground on site — a relaxed half-day if the weather's mixed.",
      category: "food",
      effort: "low",
      weather: "any",
      toddler: true,
      duration: 2,
    },
    {
      id: "ty-rainy-museum",
      title: "Zugspitze summit museum + snow world (indoor)",
      desc: "If it's socked in below, go up anyway — the summit museums and snow chamber are indoors and still spectacular above the clouds.",
      category: "culture",
      effort: "low",
      weather: "indoor",
      toddler: true,
      duration: 3,
    },
  ],

  carinthia: [
    {
      id: "ca-kaiser-franz-josef",
      title: "Kaiser-Franz-Josefs-Höhe + Pasterze Glacier viewpoint",
      desc: "The classic Grossglockner High Alpine Road stop: wide accessible terraces looking straight at Austria's highest peak and the Pasterze Glacier. Marmot-spotting for the kids, restaurant on site.",
      category: "nature",
      effort: "low",
      weather: "sunny",
      toddler: true,
      duration: 3,
    },
    {
      id: "ca-grossglockner-drive",
      title: "Grossglockner High Alpine Road, full drive",
      desc: "Toll scenic road with a stop every 30-60 min — Edelweissspitze (highest point reachable by car, hairpin access road), Hochtor Pass, and endless viewpoints. Easy to keep short with frequent breaks.",
      category: "nature",
      effort: "low",
      weather: "sunny",
      toddler: true,
      duration: 5,
    },
    {
      id: "ca-gossnitz-waterfall",
      title: "Gössnitz waterfall walk",
      desc: "Short, mostly flat walk from Heiligenblut village to a proper alpine waterfall — one of the easiest real hikes in the valley, good with a stroller partway.",
      category: "nature",
      effort: "low",
      weather: "any",
      toddler: true,
      duration: 2,
    },
    {
      id: "ca-heiligenblut-village",
      title: "Heiligenblut village + pilgrimage church",
      desc: "Postcard alpine village under the Grossglockner, gothic pilgrimage church, small cafés — an easy low-key wander for a slow morning.",
      category: "culture",
      effort: "low",
      weather: "any",
      toddler: true,
      duration: 1.5,
    },
    {
      id: "ca-glacier-railway",
      title: "Grossglockner Glacier Railway / panoramic cable car",
      desc: "Ride up for glacier and summit views without a long hike — a good option when little legs (or patience) are the limiting factor.",
      category: "adventure",
      effort: "low",
      weather: "sunny",
      toddler: true,
      duration: 2.5,
    },
    {
      id: "ca-hohe-tauern-hike",
      title: "Hohe Tauern National Park day hike",
      desc: "Proper trail into the national park among the 3,000m peaks — best with a carrier rather than a stroller, big scenery pay-off.",
      category: "nature",
      effort: "high",
      weather: "sunny",
      toddler: false,
      duration: 5,
    },
    {
      id: "ca-indoor-pool",
      title: "Indoor pool & sauna afternoon",
      desc: "Heiligenblut has an indoor swimming pool — the easy fallback for a rainy or low-energy day with a toddler.",
      category: "chill",
      effort: "low",
      weather: "indoor",
      toddler: true,
      duration: 2,
    },
    {
      id: "ca-e-bike",
      title: "Valley e-bike ride",
      desc: "Gentle e-bike route along the valley floor — flatter than it looks from the road, doable as a family if you've got a child seat/trailer.",
      category: "adventure",
      effort: "medium",
      weather: "sunny",
      toddler: true,
      duration: 3,
    },
  ],

  istria: [
    {
      id: "is-bale-beach",
      title: "Bale / Vodnjan coast beach day",
      desc: "Closest coastline to Smoljanci (~15-20 min drive) — mixed rock/pebble bays with shallow entry points, good for a toddler paddling with reef shoes.",
      category: "water",
      effort: "low",
      weather: "sunny",
      toddler: true,
      duration: 4,
    },
    {
      id: "is-rovinj",
      title: "Rovinj old town wander",
      desc: "Istria's postcard town — pastel houses, hilltop church, harbour-front gelato. Cobbled and hilly, fine with a carrier or light stroller.",
      category: "culture",
      effort: "low",
      weather: "any",
      toddler: true,
      duration: 3,
    },
    {
      id: "is-dino-park",
      title: "Dino Park Funtana",
      desc: "80+ life-size dinosaurs in a forest park, mini funfair, playgrounds — reliably a toddler favourite and shaded for hot days.",
      category: "adventure",
      effort: "low",
      weather: "sunny",
      toddler: true,
      duration: 3,
    },
    {
      id: "is-aquapark",
      title: "Aquapark Istralandia",
      desc: "Water park with a dedicated splash/family zone as well as bigger slides — good full-day option, note some slides have 1m/1.2m height minimums.",
      category: "water",
      effort: "medium",
      weather: "sunny",
      toddler: true,
      duration: 5,
    },
    {
      id: "is-sanc-michael",
      title: "Sanc. Michael medieval park",
      desc: "Medieval-themed park with archery, a carousel, farm-animal interactions and traditional food — built for families with young kids.",
      category: "adventure",
      effort: "low",
      weather: "sunny",
      toddler: true,
      duration: 3,
    },
    {
      id: "is-drijade-farm",
      title: "Drijade Farm visit",
      desc: "Small interactive farm with 100+ animals near Svetvinčenat, low-key and close to the villa — an easy morning if you don't want to drive far.",
      category: "nature",
      effort: "low",
      weather: "any",
      toddler: true,
      duration: 2,
    },
    {
      id: "is-morosini-castle",
      title: "Svetvinčenat's own Morosini-Grimani Castle",
      desc: "Right in the village you're staying near — courtyard, escape-room option for the grown-ups if you can get a sitter for an hour.",
      category: "culture",
      effort: "low",
      weather: "any",
      toddler: true,
      duration: 1.5,
    },
    {
      id: "is-pazin-cave",
      title: "Pazin Cave + zip-lining",
      desc: "Dramatic karst chasm below Pazin castle; zip-lines for the adults while younger ones watch from the viewpoint.",
      category: "adventure",
      effort: "medium",
      weather: "any",
      toddler: false,
      duration: 3,
    },
    {
      id: "is-konoba-dinner",
      title: "Konoba dinner in Svetvinčenat or Bale",
      desc: "Slow, traditional Istrian dinner (truffle pasta, local wine) at a village konoba — a good low-effort pick for a hot or tired-toddler evening.",
      category: "food",
      effort: "low",
      weather: "any",
      toddler: true,
      duration: 2,
    },
    {
      id: "is-pula-aquarium",
      title: "Pula Aquarium + amphitheatre",
      desc: "Indoor aquarium in a historic fort, combine with a look at the Roman arena in town — good rainy-day or midday-heat option.",
      category: "culture",
      effort: "low",
      weather: "indoor",
      toddler: true,
      duration: 3,
    },
  ],

  travel: [
    {
      id: "tr-salzburg",
      title: "Break the drive around Salzburg",
      desc: "~750km from Istria, leaves a manageable ~600km for day two into Vught.",
      category: "chill",
      effort: "low",
      weather: "any",
      toddler: true,
      duration: 1,
    },
    {
      id: "tr-nuremberg",
      title: "Break the drive around Nuremberg",
      desc: "~850km from Istria, shorter ~500km second day, old town worth an evening walk if you arrive with energy left.",
      category: "chill",
      effort: "low",
      weather: "any",
      toddler: true,
      duration: 1,
    },
  ],
};

// Question flow shown for every non-travel day.
const QUESTIONS = [
  {
    id: "weather",
    text: "What's the weather doing today?",
    multi: false,
    choices: [
      { label: "☀️ Sunny / warm", value: "sunny" },
      { label: "⛅ Mixed", value: "any" },
      { label: "🌧️ Rainy / cool", value: "indoor" },
    ],
  },
  {
    id: "energy",
    text: "How much energy / time do you have today?",
    multi: false,
    choices: [
      { label: "😴 Keep it short & easy", value: "low" },
      { label: "🚶 A solid half-day", value: "medium" },
      { label: "🏔️ Go big, full day", value: "high" },
    ],
  },
  {
    id: "mood",
    text: "What are you in the mood for?",
    multi: false,
    choices: [
      { label: "🌲 Nature", value: "nature" },
      { label: "💧 Water", value: "water" },
      { label: "🏛️ Culture", value: "culture" },
      { label: "🍽️ Food & relax", value: "food" },
      { label: "⚡ Adventure", value: "adventure" },
    ],
  },
  {
    id: "toddler",
    text: "Does it need to be toddler-manageable today?",
    multi: false,
    choices: [
      { label: "Yes, must be", value: true },
      { label: "No, flexible (has a sitter / nap covered)", value: false },
    ],
  },
];
