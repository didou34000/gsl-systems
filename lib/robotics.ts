/** Product taxonomy and explicit, reviewed admission; general industrial capability is insufficient. */
export const roboticsFamilies = [
 {id:'robots-plateformes',en:'Robots & platforms',fr:'Robots et plateformes',group:'machines',criteria:'Charge utile, portée, répétabilité, environnement'},
 {id:'actionnement-transmission',en:'Actuation & transmission',fr:'Actionnement et transmission',group:'metal',criteria:'Couple, vitesse, tension, jeu mécanique'},
 {id:'prehension',en:'Grippers & tooling',fr:'Préhension',group:'machines',criteria:'Charge, course, force, interface'},
 {id:'capteurs-vision',en:'Sensors & vision',fr:'Capteurs et vision',group:'electricite',criteria:'Plage, précision, fréquence, connexion'},
 {id:'commande-electronique',en:'Control & electronics',fr:'Commande et électronique',group:'electricite',criteria:'Interfaces, alimentation, compatibilité'},
 {id:'mecanique-cablage',en:'Mechanical parts & cabling',fr:'Composants mécaniques et câblage',group:'metal',criteria:'Dimensions, matières, tolérances, contraintes d’usage'},
] as const;
export const roboticsMetrics:Record<string,{key:string;en:string;fr:string;unit:string}[]>={
 'robots-plateformes':[{key:'payload_kg',en:'Payload',fr:'Charge utile',unit:'kg'},{key:'reach_mm',en:'Reach',fr:'Portée',unit:'mm'},{key:'repeatability_mm',en:'Repeatability',fr:'Répétabilité',unit:'mm'}],
 'actionnement-transmission':[{key:'torque_nm',en:'Torque',fr:'Couple',unit:'N·m'},{key:'speed_rpm',en:'Speed',fr:'Vitesse',unit:'tr/min'},{key:'backlash_arcmin',en:'Backlash',fr:'Jeu mécanique',unit:'arcmin'},{key:'voltage_v',en:'Voltage',fr:'Tension',unit:'V'}],
 prehension:[{key:'force_n',en:'Gripping force',fr:'Force de préhension',unit:'N'},{key:'stroke_mm',en:'Stroke',fr:'Course',unit:'mm'},{key:'payload_kg',en:'Payload',fr:'Charge utile',unit:'kg'}],
 'capteurs-vision':[{key:'frequency_hz',en:'Frequency',fr:'Fréquence',unit:'Hz'},{key:'range_n',en:'Force range',fr:'Plage de force',unit:'N'}],
 'commande-electronique':[{key:'voltage_v',en:'Supply voltage',fr:'Tension d’alimentation',unit:'V'}],
 'mecanique-cablage':[{key:'tolerance_mm',en:'Tolerance',fr:'Tolérance',unit:'mm'},{key:'length_mm',en:'Length',fr:'Longueur',unit:'mm'}],
};
export function technicalRows(family:string,specs:Record<string,string>){return (roboticsMetrics[family]||[]).filter(m=>specs[m.key]!==undefined&&specs[m.key]!=='').map(m=>({...m,value:specs[m.key]}));}
export function roboticsQuery(query:string){return query.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\brobotics?\b|\brobotique\b/g,'robot').replace(/\bprehenseurs?\b|\bgrippers?\b|\bpinces?\b/g,'gripper').replace(/\bservomoteurs?\b|\bservo motors?\b/g,'servo').replace(/\breducteurs?\b|\bgearboxes?\b/g,'gearbox').replace(/\bencodeurs?\b|\bencoders?\b/g,'encoder').replace(/n[ ·]*m\b/g,'nm').replace(/(\d),(\d)/g,'$1.$2').replace(/\s+/g,' ').trim();}
