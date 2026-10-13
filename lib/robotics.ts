/** Product taxonomy and explicit, reviewed admission; general industrial capability is insufficient. */
export const roboticsFamilies = [
 {id:'actionnement-transmission',en:'Motors, servos & actuators',fr:'Moteurs, servomoteurs et actionneurs',group:'metal',criteria:'Couple, vitesse, tension, retour de position',examplesEn:'Rotary and linear motors and actuators',examplesFr:'Moteurs et actionneurs rotatifs ou linéaires'},
 {id:'transmissions-guidages',en:'Reducers, transmission & guidance',fr:'Réducteurs, transmissions et guidages',group:'metal',criteria:'Couple, rapport de réduction, jeu, rigidité',examplesEn:'Reducers, screws, bearings and linear guides',examplesFr:'Réducteurs, vis, roulements et guidages linéaires'},
 {id:'capteurs-vision',en:'Sensors & vision',fr:'Capteurs et systèmes de vision',group:'electricite',criteria:'Plage, précision, fréquence, connexion',examplesEn:'Encoders, force sensors and vision systems',examplesFr:'Codeurs, capteurs d’effort et systèmes de vision'},
 {id:'commande-electronique',en:'Controllers & embedded electronics',fr:'Cartes électroniques, contrôleurs et informatique embarquée',group:'electricite',criteria:'Interfaces, alimentation, compatibilité',examplesEn:'PCBs, controllers and embedded computing',examplesFr:'PCB, contrôleurs et calcul embarqué'},
 {id:'cables-connecteurs',en:'Cables, connectors & harnesses',fr:'Câbles, connecteurs et faisceaux',group:'electricite',criteria:'Flexion, torsion, connectique, durée de vie',examplesEn:'Dynamic cables, harnesses and connectors',examplesFr:'Câbles dynamiques, faisceaux et connecteurs'},
 {id:'energie-batteries',en:'Batteries, power & energy management',fr:'Batteries, alimentations et gestion de l’énergie',group:'electricite',criteria:'Tension, capacité, autonomie, transport',examplesEn:'Batteries, BMS, chargers and power supplies',examplesFr:'Batteries, BMS, chargeurs et alimentations'},
 {id:'prehension',en:'Grippers & tooling',fr:'Préhenseurs et outils',group:'machines',criteria:'Charge, course, force, interface',examplesEn:'Grippers and end effectors',examplesFr:'Pinces et effecteurs'},
 {id:'pieces-mecaniques',en:'Mechanical parts, structures & materials',fr:'Pièces mécaniques, structures et matériaux adaptés',group:'metal',criteria:'Dimensions, matières, tolérances, usage robotique',examplesEn:'Robot structures and mechanical components',examplesFr:'Structures et composants mécaniques pour robots'},
] as const;
export const roboticsMetrics:Record<string,{key:string;en:string;fr:string;unit:string}[]>={
 'robots-plateformes':[{key:'payload_kg',en:'Payload',fr:'Charge utile',unit:'kg'},{key:'reach_mm',en:'Reach',fr:'Portée',unit:'mm'},{key:'repeatability_mm',en:'Repeatability',fr:'Répétabilité',unit:'mm'}],
 'transmissions-guidages':[{key:'torque_nm',en:'Torque',fr:'Couple',unit:'N·m'},{key:'backlash_arcmin',en:'Backlash',fr:'Jeu mécanique',unit:'arcmin'}],
 'cables-connecteurs':[{key:'length_mm',en:'Length',fr:'Longueur',unit:'mm'},{key:'voltage_v',en:'Voltage',fr:'Tension',unit:'V'}],
 'energie-batteries':[{key:'voltage_v',en:'Voltage',fr:'Tension',unit:'V'},{key:'capacity_ah',en:'Capacity',fr:'Capacité',unit:'Ah'}],
 'pieces-mecaniques':[{key:'tolerance_mm',en:'Tolerance',fr:'Tolérance',unit:'mm'},{key:'length_mm',en:'Length',fr:'Longueur',unit:'mm'}],
 'actionnement-transmission':[{key:'torque_nm',en:'Torque',fr:'Couple',unit:'N·m'},{key:'speed_rpm',en:'Speed',fr:'Vitesse',unit:'tr/min'},{key:'backlash_arcmin',en:'Backlash',fr:'Jeu mécanique',unit:'arcmin'},{key:'voltage_v',en:'Voltage',fr:'Tension',unit:'V'}],
 prehension:[{key:'force_n',en:'Gripping force',fr:'Force de préhension',unit:'N'},{key:'stroke_mm',en:'Stroke',fr:'Course',unit:'mm'},{key:'payload_kg',en:'Payload',fr:'Charge utile',unit:'kg'}],
 'capteurs-vision':[{key:'frequency_hz',en:'Frequency',fr:'Fréquence',unit:'Hz'},{key:'range_n',en:'Force range',fr:'Plage de force',unit:'N'}],
 'commande-electronique':[{key:'voltage_v',en:'Supply voltage',fr:'Tension d’alimentation',unit:'V'}],
 'mecanique-cablage':[{key:'tolerance_mm',en:'Tolerance',fr:'Tolérance',unit:'mm'},{key:'length_mm',en:'Length',fr:'Longueur',unit:'mm'}],
};
export function technicalRows(family:string,specs:Record<string,string>){return (roboticsMetrics[family]||[]).filter(m=>specs[m.key]!==undefined&&specs[m.key]!=='').map(m=>({...m,value:specs[m.key]}));}
export function roboticsQuery(query:string){return query.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\brobotics?\b|\brobotique\b/g,'robot').replace(/\bprehenseurs?\b|\bgrippers?\b|\bpinces?\b/g,'gripper').replace(/\bservomoteurs?\b|\bservo motors?\b/g,'servo').replace(/\breducteurs?\b|\bgearboxes?\b/g,'gearbox').replace(/\bencodeurs?\b|\bencoders?\b/g,'encoder').replace(/n[ ·]*m\b/g,'nm').replace(/(\d),(\d)/g,'$1.$2').replace(/\s+/g,' ').trim();}
