import { Question } from "./questions";

export const staticQuestionBank: Question[] = [
  {
    id: "q-ata27-01",
    topicId: "ata-27",
    ata: "ATA 27 · Flight Controls",
    difficulty: "standard",
    prompt: "On the A320, with both elevators and the THS available, which control surface provides primary pitch trim during normal law cruise?",
    choices: [
      { id: "a", label: "The elevators commanded directly by the side-stick." },
      { id: "b", label: "The THS automatically positioned by the ELACs." },
      { id: "c", label: "The THS commanded by the manual trim wheels only." },
      { id: "d", label: "The spoilers acting in symmetry to offset pitch moment." },
    ],
    correct: "b",
    explanation: "In Normal Law, the ELACs command the Trimmable Horizontal Stabilizer (THS) to off-load the elevators and hold the commanded flight path. The elevators handle short-term pitch maneuvers, while the THS holds steady long-term trim.",
    references: ["FCOM 1.27.20 · Pitch Control", "A320 ATA 27-30-00"]
  },
  {
    id: "q-ata27-02",
    topicId: "ata-27",
    ata: "ATA 27 · Flight Controls",
    difficulty: "standard",
    prompt: "In Normal Law, what does the sidestick command in the pitch axis?",
    diagramCaption: "Sidestick Pitch Input to ELAC Logic",
    choices: [
      { id: "a", label: "Load factor (G) proportional to stick deflection." },
      { id: "b", label: "Direct elevator surface angular deflection." },
      { id: "c", label: "A specific aircraft pitch attitude in degrees." },
      { id: "d", label: "A rate of climb or descent." },
    ],
    correct: "a",
    explanation: "At flight speeds, pitch sidestick deflection commands a load factor (G) proportional to stick deflection. The flight control computers then compute the required elevator/THS movement to achieve that commanded G-load.",
    references: ["FCOM 1.27.20 · Normal Law Pitch"]
  },
  {
    id: "q-ata27-03",
    topicId: "ata-27",
    ata: "ATA 27 · Flight Controls",
    difficulty: "complex",
    prompt: "If both ELACs (Elevator Aileron Computers) fail in flight, what happens to pitch control?",
    choices: [
      { id: "a", label: "Pitch control is completely lost." },
      { id: "b", label: "Pitch control transfers mechanically to the trim wheels." },
      { id: "c", label: "Pitch control transfers to the SECs (SEC 1 or SEC 2)." },
      { id: "d", label: "The FACs (Flight Augmentation Computers) take over pitch." },
    ],
    correct: "c",
    explanation: "ELACs are the primary computers for the elevator and THS. If both ELAC 1 and ELAC 2 fail, Spoiler Elevator Computers (SECs) 1 or 2 take over pitch control, transitioning the aircraft into Alternate Law.",
    references: ["FCOM 1.27.10 · Architecture", "FCOM 1.27.20 · Reconfiguration"]
  },
  {
    id: "q-ata27-04",
    topicId: "ata-27",
    ata: "ATA 27 · Flight Controls",
    difficulty: "standard",
    prompt: "How many spoiler panels are installed on each wing, and how many are used for roll control?",
    choices: [
      { id: "a", label: "3 panels per wing; all 3 are used for roll." },
      { id: "b", label: "5 panels per wing; panels 2, 3, 4, 5 are used for roll." },
      { id: "c", label: "6 panels per wing; panels 1 through 4 are used for roll." },
      { id: "d", label: "5 panels per wing; only panel 5 is used for roll." },
    ],
    correct: "b",
    explanation: "The A320 has 5 spoiler panels per wing. Panel 1 (inboard) is a ground spoiler only. Panels 2, 3, 4, and 5 can act as roll spoilers, speedbrakes, and ground spoilers.",
    references: ["FCOM 1.27.10 · Spoilers Description"]
  },
  {
    id: "q-ata27-05",
    topicId: "ata-27",
    ata: "ATA 27 · Flight Controls",
    difficulty: "complex",
    prompt: "When do the ground spoilers automatically extend fully during landing, assuming they are armed?",
    choices: [
      { id: "a", label: "Both main landing gears compressed, and both thrust levers at or below IDLE." },
      { id: "b", label: "Radar altimeter descends below 10 feet." },
      { id: "c", label: "Nose landing gear touches down." },
      { id: "d", label: "Wheel speed exceeds 72 knots." },
    ],
    correct: "a",
    explanation: "If armed, ground spoilers automatically fully deploy when both main landing gears are compressed and both thrust levers are at or below the IDLE position. Partial deployment can occur under specific single-gear conditions, but full requires both.",
    references: ["FCOM 1.27.10 · Ground Spoilers Logic"]
  },
  {
    id: "q-ata27-06",
    topicId: "ata-27",
    ata: "ATA 27 · Flight Controls",
    difficulty: "extreme",
    prompt: "What happens to roll control relationships when the aircraft degrades into Direct Law?",
    choices: [
      { id: "a", label: "Roll rate is commanded by the sidestick up to a maximum of 15°/sec." },
      { id: "b", label: "Sidestick deflection directly commands aileron and spoiler angular deflection." },
      { id: "c", label: "Only the rudder can induce roll via secondary aerodynamic effect." },
      { id: "d", label: "Roll control remains a roll rate demand, but at a reduced maximum rate." },
    ],
    correct: "b",
    explanation: "In Direct Law, the relationship between sidestick position and control surface movement becomes linear and direct (kinematic ratio). You are no longer commanding a roll rate; you are directly positioning the ailerons and roll spoilers.",
    references: ["FCOM 1.27.30 · Direct Law Controls"]
  },
  {
    id: "q-ata27-07",
    topicId: "ata-27",
    ata: "ATA 27 · Flight Controls",
    difficulty: "standard",
    prompt: "Which pair of computers is responsible for rudder control and yaw damping in Normal Law?",
    choices: [
      { id: "a", label: "ELAC 1 and ELAC 2" },
      { id: "b", label: "SEC 1 and SEC 2" },
      { id: "c", label: "FAC 1 and FAC 2" },
      { id: "d", label: "FMGEC 1 and FMGEC 2" },
    ],
    correct: "c",
    explanation: "The Flight Augmentation Computers (FACs) handle all yaw-axis tasks: yaw damping, turn coordination, rudder trim, and rudder travel limitation based on airspeed.",
    references: ["FCOM 1.27.40 · Yaw Control"]
  },
  {
    id: "q-ata27-08",
    topicId: "ata-27",
    ata: "ATA 27 · Flight Controls",
    difficulty: "complex",
    prompt: "What are the mechanical deflection limits of the Trimmable Horizontal Stabilizer (THS)?",
    choices: [
      { id: "a", label: "13.5° Nose Up, 4° Nose Down" },
      { id: "b", label: "15.0° Nose Up, 5° Nose Down" },
      { id: "c", label: "8.0° Nose Up, 8° Nose Down" },
      { id: "d", label: "11.5° Nose Up, 2° Nose Down" },
    ],
    correct: "a",
    explanation: "The mechanical limit stops for the THS jackscrew allow a maximum deflection of 13.5° nose up (aircraft nose up, stabilizer leading edge down) and 4° nose down.",
    references: ["FCOM 1.27.10 · THS Actuation System"]
  },
  // --- METEOROLOGY (met-1) ---
  {
    id: "q-met-01",
    topicId: "met-1",
    ata: "Meteorology",
    difficulty: "standard",
    prompt: "What is the primary cause of all changes in the Earth's weather?",
    choices: [
      { id: "a", label: "Variations of solar energy at the Earth's surface." },
      { id: "b", label: "Changes in air pressure." },
      { id: "c", label: "Movement of different air masses." },
      { id: "d", label: "The Coriolis force." },
    ],
    correct: "a",
    explanation: "Variations in solar energy (heating) at the Earth's surface lead to temperature differences, which cause pressure differences and subsequently all weather.",
    references: ["Aviation Weather Services"]
  },
  {
    id: "q-met-02",
    topicId: "met-1",
    ata: "Meteorology",
    difficulty: "standard",
    prompt: "Where is the tropopause typically the lowest?",
    choices: [
      { id: "a", label: "At the poles." },
      { id: "b", label: "At the equator." },
      { id: "c", label: "Over the oceans in summer." },
      { id: "d", label: "At mid-latitudes." },
    ],
    correct: "a",
    explanation: "The tropopause is lower at the poles (approx 26,000 ft) than at the equator (up to 55,000 ft) due to colder, denser air.",
    references: ["Atmosphere structure"]
  },
  {
    id: "q-met-03",
    topicId: "met-1",
    ata: "Meteorology",
    difficulty: "complex",
    prompt: "What condition is necessary for the formation of aircraft icing?",
    choices: [
      { id: "a", label: "Visible moisture and temperatures above freezing." },
      { id: "b", label: "High humidity and temperatures below freezing." },
      { id: "c", label: "Visible moisture (liquid) and temperature at or below 0°C." },
      { id: "d", label: "Ice crystals and a temperature below -40°C." },
    ],
    correct: "c",
    explanation: "Icing requires visible moisture in the form of supercooled water droplets (liquid state) and an aircraft skin temperature below freezing.",
    references: ["Icing conditions"]
  },
  {
    id: "q-met-04",
    topicId: "met-1",
    ata: "Meteorology",
    difficulty: "complex",
    prompt: "A microburst is characterized by:",
    choices: [
      { id: "a", label: "An updraft followed by a downdraft spreading outwards up to 2.5 miles." },
      { id: "b", label: "A localized downdraft causing a divergence of wind at the surface of up to 2.5 miles." },
      { id: "c", label: "Steady winds aloft exceeding 50 knots." },
      { id: "d", label: "Prolonged severe turbulence lasting hours." },
    ],
    correct: "b",
    explanation: "A microburst is a localized, intense downdraft (less than 2.5 miles across) that creates strong wind shear and hazardous divergence at the surface.",
    references: ["Thunderstorms/Microbursts"]
  },
  {
    id: "q-met-05",
    topicId: "met-1",
    ata: "Meteorology",
    difficulty: "standard",
    prompt: "What does the code 'BR' denote in a METAR?",
    choices: [
      { id: "a", label: "Mist" },
      { id: "b", label: "Broken clouds" },
      { id: "c", label: "Rain showers" },
      { id: "d", label: "Blowing spray" },
    ],
    correct: "a",
    explanation: "BR stands for Mist (from French 'brume'). Visibility is generally between 5/8 SM and 6 SM.",
    references: ["Aviation Weather - METAR Decoding"]
  },
  
  // --- AIR REGULATION (reg-1) ---
  {
    id: "q-reg-01",
    topicId: "reg-1",
    ata: "Air Regulation",
    difficulty: "standard",
    prompt: "According to ICAO Annex 2, who has final authority as to the disposition of the aircraft?",
    choices: [
      { id: "a", label: "Air Traffic Control" },
      { id: "b", label: "The aircraft operator/owner" },
      { id: "c", label: "The pilot-in-command" },
      { id: "d", label: "The local civil aviation authority" },
    ],
    correct: "c",
    explanation: "The pilot-in-command of an aircraft shall have final authority as to the disposition of the aircraft while in command.",
    references: ["ICAO Annex 2 - Rules of the Air, 2.4"]
  },
  {
    id: "q-reg-02",
    topicId: "reg-1",
    ata: "Air Regulation",
    difficulty: "complex",
    prompt: "When two aircraft are converging at approximately the same altitude, the aircraft that has the other on its right shall give way, EXCEPT:",
    choices: [
      { id: "a", label: "Power-driven heavier-than-air aircraft shall give way to airships, gliders, and balloons." },
      { id: "b", label: "Faster aircraft must yield to slower aircraft." },
      { id: "c", label: "IFR traffic always gives way to VFR traffic." },
      { id: "d", label: "Towing aircraft give way to all other power-driven aircraft." },
    ],
    correct: "a",
    explanation: "Power-driven heavier-than-air aircraft must give way to airships, gliders, and balloons because they are less maneuverable.",
    references: ["ICAO Annex 2 - Rules of the Air, Right of Way"]
  },
  {
    id: "q-reg-03",
    topicId: "reg-1",
    ata: "Air Regulation",
    difficulty: "standard",
    prompt: "What is the standard VFR squawk code?",
    choices: [
      { id: "a", label: "2000" },
      { id: "b", label: "7000 (EASA/ICAO Europe)" },
      { id: "c", label: "1200 (FAA/North America)" },
      { id: "d", label: "Both B and C depend on region." },
    ],
    correct: "d",
    explanation: "7000 is the standard VFR squawk in Europe/EASA, while 1200 is standard in the US/FAA.",
    references: ["Transponder Codes"]
  },
  {
    id: "q-reg-04",
    topicId: "reg-1",
    ata: "Air Regulation",
    difficulty: "standard",
    prompt: "Which squawk code indicates a loss of communication?",
    choices: [
      { id: "a", label: "7500" },
      { id: "b", label: "7600" },
      { id: "c", label: "7700" },
      { id: "d", label: "7777" },
    ],
    correct: "b",
    explanation: "7600 indicates a radio communication failure.",
    references: ["Emergency and Abnormal Squawk Codes"]
  },
  {
    id: "q-reg-05",
    topicId: "reg-1",
    ata: "Air Regulation",
    difficulty: "complex",
    prompt: "A Special VFR (SVFR) flight may be cleared to operate within a CTR provided the visibility is not less than:",
    choices: [
      { id: "a", label: "1500 meters" },
      { id: "b", label: "3000 meters" },
      { id: "c", label: "5000 meters" },
      { id: "d", label: "8000 meters" },
    ],
    correct: "a",
    explanation: "A Special VFR clearance requires a minimum visibility of 1500m (or higher depending on local CAAs and helicopter vs fixed wing), but 1500m is the standard ICAO baseline for fixed wing.",
    references: ["ICAO Special VFR Minima"]
  },

  // --- AIR NAVIGATION (nav-gen) ---
  {
    id: "q-nav-01",
    topicId: "nav-gen",
    ata: "Air Navigation",
    difficulty: "standard",
    prompt: "Where is the convergence of meridians the greatest?",
    choices: [
      { id: "a", label: "At the Equator." },
      { id: "b", label: "At the Poles." },
      { id: "c", label: "At 45° Latitude." },
      { id: "d", label: "Meridians are everywhere parallel." },
    ],
    correct: "b",
    explanation: "Meridians converge more as they approach the poles, reaching maximum convergence at the geographic poles.",
    references: ["General Navigation - Earth Properties"]
  },
  {
    id: "q-nav-02",
    topicId: "nav-gen",
    ata: "Air Navigation",
    difficulty: "complex",
    prompt: "An aircraft is flying at FL350 with a True Airspeed (TAS) of 450 knots. The wind headwind is 50 knots. What is the Ground Speed?",
    choices: [
      { id: "a", label: "500 kts" },
      { id: "b", label: "400 kts" },
      { id: "c", label: "350 kts" },
      { id: "d", label: "450 kts" },
    ],
    correct: "b",
    explanation: "Ground speed is TAS minus headwind (or plus tailwind). 450 - 50 = 400 kts.",
    references: ["General Nav - Wind Vector"]
  },
  {
    id: "q-nav-03",
    topicId: "nav-gen",
    ata: "Air Navigation",
    difficulty: "standard",
    prompt: "1 Nautical Mile (NM) is equal to:",
    choices: [
      { id: "a", label: "1 minute of latitude." },
      { id: "b", label: "1 degree of latitude." },
      { id: "c", label: "1 minute of longitude at the equator." },
      { id: "d", label: "Both a and c." },
    ],
    correct: "d",
    explanation: "A nautical mile is officially 1,852 meters. It historically corresponds to one minute of latitude anywhere, and one minute of longitude at the equator.",
    references: ["General Nav - Distance"]
  },
  {
    id: "q-nav-04",
    topicId: "nav-gen",
    ata: "Air Navigation",
    difficulty: "complex",
    prompt: "On a Lambert Conformal Conic chart, great circles appear as:",
    choices: [
      { id: "a", label: "Straight lines everywhere." },
      { id: "b", label: "Curves concave to the parallel of origin." },
      { id: "c", label: "Substantially straight lines." },
      { id: "d", label: "Curves convex to the equator." },
    ],
    correct: "c",
    explanation: "Due to the conic projection, great circles are substantially straight lines, making this chart ideal for navigation.",
    references: ["General Nav - Map Projections"]
  },
  {
    id: "q-nav-05",
    topicId: "nav-gen",
    ata: "Air Navigation",
    difficulty: "extreme",
    prompt: "Isogonic lines connect points of:",
    choices: [
      { id: "a", label: "Equal magnetic deviation." },
      { id: "b", label: "Equal magnetic dip." },
      { id: "c", label: "Equal magnetic variation." },
      { id: "d", label: "Zero magnetic variation." },
    ],
    correct: "c",
    explanation: "Isogonic lines connect points of equal magnetic variation. Agonic lines connect points of zero variation.",
    references: ["General Nav - Magnetism"]
  },

  // --- PRINCIPLES OF FLIGHT (pof-stability) ---
  {
    id: "q-pof-01",
    topicId: "pof-stability",
    ata: "Principles of Flight",
    difficulty: "standard",
    prompt: "Longitudinal stability is primarily controlled by the:",
    choices: [
      { id: "a", label: "Ailerons." },
      { id: "b", label: "Rudder." },
      { id: "c", label: "Horizontal stabilizer." },
      { id: "d", label: "Wing sweep." },
    ],
    correct: "c",
    explanation: "The horizontal stabilizer (tailplane) provides the primary balancing force and stability in the longitudinal (pitch) axis.",
    references: ["PoF - Stability and Control"]
  },
  {
    id: "q-pof-02",
    topicId: "pof-stability",
    ata: "Principles of Flight",
    difficulty: "complex",
    prompt: "An aft center of gravity (CG) limit is dictated primarily by:",
    choices: [
      { id: "a", label: "Takeoff performance." },
      { id: "b", label: "Fuel consumption considerations." },
      { id: "c", label: "Minimum acceptable longitudinal stability." },
      { id: "d", label: "Elevator structure." },
    ],
    correct: "c",
    explanation: "As the CG moves aft, the moment arm to the tailplane decreases, reducing longitudinal stability. The aft limit guarantees minimum stability.",
    references: ["PoF - CG Limits"]
  },
  {
    id: "q-pof-03",
    topicId: "pof-stability",
    ata: "Principles of Flight",
    difficulty: "standard",
    prompt: "Dihedral provides stability primarily around which axis?",
    choices: [
      { id: "a", label: "Longitudinal (Roll)." },
      { id: "b", label: "Lateral (Pitch)." },
      { id: "c", label: "Normal (Yaw)." },
      { id: "d", label: "Vertical." },
    ],
    correct: "a",
    explanation: "Dihedral increases the angle of attack on the lower wing when the aircraft slips during a bank, creating a rolling moment that restores level flight (roll stability).",
    references: ["PoF - Lateral Stability"]
  },
  {
    id: "q-pof-04",
    topicId: "pof-stability",
    ata: "Principles of Flight",
    difficulty: "complex",
    prompt: "Dutch roll is a coupled oscillation involving:",
    choices: [
      { id: "a", label: "Pitch and roll." },
      { id: "b", label: "Yaw and pitch." },
      { id: "c", label: "Roll and yaw." },
      { id: "d", label: "Airspeed and pitch." },
    ],
    correct: "c",
    explanation: "Dutch roll is an oscillatory instability linking yaw and roll. It usually occurs when lateral stability (dihedral effect) is stronger than directional stability.",
    references: ["PoF - Dynamic Stability"]
  },
  {
    id: "q-pof-05",
    topicId: "pof-stability",
    ata: "Principles of Flight",
    difficulty: "extreme",
    prompt: "The neutral point of an aircraft is:",
    choices: [
      { id: "a", label: "The CG position where the longitudinal static stability is zero." },
      { id: "b", label: "The CG position for maximum range." },
      { id: "c", label: "The aerodynamic center of the wing alone." },
      { id: "d", label: "The point where lift equals weight." },
    ],
    correct: "a",
    explanation: "The neutral point is the whole-aircraft aerodynamic center. If the CG is at the neutral point, static longitudinal stability is exactly zero.",
    references: ["PoF - Neutral Point and Static Margin"]
  }
];
