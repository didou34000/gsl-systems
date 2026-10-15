/** Manufacturers identified from public sources only. They are not registered, have not been contacted and are not verified by GSL; enquiries go through GSL. Unpublished values stay absent. */
/** A product picture with its rights. `illustration`: free photo of the same kind of object, not this product. `manufacturer`: the maker's photo, used with its written permission. */
export type ProductImage={src:string;kind:'illustration'|'manufacturer';credit:string;license:string;sourceUrl:string};
export type ReferencedMaker={id:string;image?:ProductImage;company:string;country:string;city:string;website:string;family:string;productEn:string;productFr:string;reference:string;specs:{en:string;fr:string;value:string;valueFr?:string}[];noteEn:string;noteFr:string;sources:{url:string;title:string}[];checkedAt:string};
export const referencedMakers:ReferencedMaker[]=[
 {id:'wat-servo-400w',company:'WAT Motor',country:'TR',city:'Kapaklı (Tekirdağ)',website:'https://www.wat.com.tr',family:'actionnement-transmission',productEn:'400 W servo motor with integrated drive',productFr:'Servomoteur 400 W à variateur intégré',reference:'400W Entegre Motor Sürücü',
  specs:[{en:'Power',fr:'Puissance',value:'400 W'},{en:'Communication',fr:'Communication',value:'CAN, RS485'},{en:'Control modes',fr:'Modes de contrôle',value:'speed, position, torque',valueFr:'vitesse, position, couple'}],
  noteEn:'Integrated servo motor without reducer, not a complete joint actuator.',noteFr:'Servomoteur intégré sans réducteur, pas un actionneur d’articulation complet.',
  sources:[{url:'https://www.wat.com.tr/hareket-kontrol-teknolojileri/entegre-suruculu-servo-motorlar',title:'WAT, servomoteurs à variateur intégré'},{url:'https://www.wat.com.tr/iletisim/bize-ulasin',title:'WAT, contact et usine'}],checkedAt:'2026-10-13'},
 {id:'opkon-mra50',company:'OPKON',country:'TR',city:'Istanbul',website:'https://www.opkon.com.tr',family:'capteurs-vision',productEn:'Magnetic absolute rotary encoder, SSI',productFr:'Codeur rotatif absolu magnétique SSI',reference:'MRA 50',
  specs:[{en:'Resolution',fr:'Résolution',value:'10 or 12 bits / 360°',valueFr:'10 ou 12 bits / 360°'},{en:'Interface',fr:'Interface',value:'SSI'},{en:'Supply',fr:'Alimentation',value:'8–24 VDC'},{en:'Max. speed',fr:'Vitesse max.',value:'1000 rpm',valueFr:'1000 tr/min'},{en:'Housing',fr:'Boîtier',value:'Ø 50 mm'}],
  noteEn:'Industrial 50 mm encoder, too large for a compact humanoid joint.',noteFr:'Codeur industriel de 50 mm, trop gros pour une articulation compacte de robot humanoïde.',
  sources:[{url:'https://www.forum.linuxcnc.org/media/kunena/attachments/28265/Opkon_MRA50_Esite_2021-04-27.pdf',title:'Fiche technique OPKON MRA 50'},{url:'https://ethercat.org/de/members/members_A8C0BEBA5AAF40089EFAACDE0888EC7D.htm',title:'EtherCAT Technology Group, fiche membre OPKON'}],checkedAt:'2026-10-13'},
 {id:'cure-bionics-hannibal',company:'Cure Bionics',country:'TN',city:'Sousse',website:'https://curebionics.com',family:'prehension',productEn:'Myoelectric bionic hand',productFr:'Main bionique myoélectrique',reference:'Hannibal Bionic Hand',
  specs:[{en:'Mass',fr:'Masse',value:'about 600 g',valueFr:'environ 600 g'},{en:'Control',fr:'Commande',value:'EMG'},{en:'Sizes',fr:'Tailles',value:'M and L',valueFr:'M et L'}],
  noteEn:'A prosthesis, not a robotic hand; gripping force is not published.',noteFr:'Prothèse, pas une main robotique ; la force de préhension n’est pas publiée.',
  sources:[{url:'https://www.ecomondo.com/restricted-assets/digital-profiles/01_ATTACHMENTS/RIC25/Cure-Bionics-Catalog-EN-260425-V4-0-compresse-68f2240fd2f8c.pdf.pdf',title:'Catalogue Cure Bionics 2025'},{url:'https://curebionics.com/',title:'Cure Bionics, site officiel'}],checkedAt:'2026-10-13'},
 {id:'acrome-smd-red',company:'Acrome Robotics',country:'TR',city:'Istanbul',website:'https://acrome.net',family:'commande-electronique',productEn:'Smart DC motor driver',productFr:'Driver intelligent pour moteur DC',reference:'SMD RED',
  specs:[{en:'Supply',fr:'Alimentation',value:'9–16 VDC'},{en:'Bus',fr:'Bus',value:'RS-485'},{en:'Control',fr:'Régulation',value:'PID; speed, position, current',valueFr:'PID ; vitesse, position, courant'},{en:'Feedback',fr:'Retour',value:'quadrature encoder',valueFr:'codeur en quadrature'}],
  noteEn:'Electronics for education and R&D, not an industrial EtherCAT drive.',noteFr:'Électronique pour l’enseignement et la R&D, pas un variateur EtherCAT industriel.',
  sources:[{url:'https://acrome.net/product/smart-motion-devices',title:'Acrome, Smart Motion Devices'},{url:'https://acrome.net/',title:'Acrome, site officiel'}],checkedAt:'2026-10-13'},
 {id:'akinrobotics-akinci-5',company:'AKINROBOTICS',country:'TR',city:'Konya',website:'https://www.akinrobotics.com',family:'robots-plateformes',productEn:'AKINCI-5 humanoid robot',productFr:'Robot humanoïde AKINCI-5',reference:'AKINCI-5',
  specs:[],
  noteEn:'Prototype under testing, not commercially available.',noteFr:'Prototype en test, pas encore commercialisé.',
  sources:[{url:'https://www.akinrobotics.com/en',title:'AKINROBOTICS, site officiel'},{url:'https://humanoid.guide/product/akinci-5/',title:'humanoid.guide, AKINCI-5'}],checkedAt:'2026-10-13'},
];

/** Public page addresses of the referenced entries: one product page per entry, one maker page per company. */
export const referencedMakerId=(m:Pick<ReferencedMaker,'company'>)=>'repere-'+m.company.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const referencedProductHref=(m:Pick<ReferencedMaker,'id'>)=>'/produits/'+m.id;
export const referencedMakerHref=(m:Pick<ReferencedMaker,'company'>)=>'/fabricants/'+referencedMakerId(m);
export const findReferencedProduct=(id:string)=>referencedMakers.find(m=>m.id===id)||null;
export const findReferencedMaker=(id:string)=>{const products=referencedMakers.filter(m=>referencedMakerId(m)===id);return products.length?products:null};
