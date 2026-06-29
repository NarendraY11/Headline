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
];
