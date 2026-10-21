/** Local legal forms suggested for the "local legal form" fields (sign-up and supplier profile).
 *  The field stays free text: the list only suggests the forms an official extract would show.
 *
 *  Sources
 *  - 117 countries: ISO 20275 Entity Legal Forms code list published by GLEIF, version dated 2023-09-28
 *    (active entries only), copied from the official CSV bundled in the PyPI package iso-20275 0.0.18
 *    (sha256 8c79029b55ce19aa220f0cd0d80a8fa8d0e2d483996f232f646607e1839d93ff). GLEIF has since
 *    published v1.6 (2026-02-19): https://www.gleif.org/en/about-lei/iso-20275-entity-legal-forms-code-list
 *    Data in legal-forms-elf.json: [local name, local abbreviation?, transliterated name?], forms with an abbreviation first.
 *  - Sourcing countries absent from ISO 20275 (MA, BA, MD, GE, AL, EG): `researchedForms` below,
 *    each with the text it comes from. `verified:false` marks a form taken from a secondary source. */
export type LegalForm={name:string;abbreviation?:string;transliteration?:string;verified?:boolean};
type Researched={sources:readonly string[];forms:readonly LegalForm[]};

export const researchedForms:Record<string,Researched>={
 MA:{sources:['Loi n° 5-96 (SNC, SCS, SCA, SARL, société en participation), art. 1, https://www.mites.gob.es/ficheros/ministerio/mundo/consejerias/marruecos_archivos/Ley_5_96.pdf','Loi n° 17-95 (SA) et loi n° 19-20 (SAS, SARL AU), https://turtl.tamimi.com/story/developments-in-company-structures-in-morocco/'],forms:[
  {name:'Société anonyme',abbreviation:'SA'},
  {name:'Société par actions simplifiée',abbreviation:'SAS'},
  {name:'Société par actions simplifiée à associé unique',abbreviation:'SASU'},
  {name:'Société à responsabilité limitée',abbreviation:'SARL'},
  {name:'Société à responsabilité limitée à associé unique',abbreviation:'SARL AU'},
  {name:'Société en nom collectif',abbreviation:'SNC'},
  {name:'Société en commandite simple',abbreviation:'SCS'},
  {name:'Société en commandite par actions',abbreviation:'SCA'},
  {name:'Société en participation'},
 ]},
 AL:{sources:['Ligji nr. 9901/2008 « Për tregtarët dhe shoqëritë tregtare », art. 1 et 2 (version anglaise publiée par le QKB), https://qkb.gov.al/site/wp-content/uploads/2025/09/ENG-ligj-2008-04-14-9901-i-perditesuar.pdf'],forms:[
  {name:'Shoqëri me përgjegjësi të kufizuar',abbreviation:'sh.p.k.'},
  {name:'Shoqëri aksionare',abbreviation:'sh.a.'},
  {name:'Shoqëri kolektive'},
  {name:'Shoqëri komandite'},
  {name:'Person fizik tregtar'},
 ]},
 BA:{sources:['FIPA (agence de promotion des investissements de Bosnie-Herzégovine), « Types of companies in BiH » : lois sur les sociétés de la FBiH (JO 81/15, 75/21) et de la Republika Srpska (JO 127/08 … 17/23), https://fipa.vijeceministara.gov.ba/en/types-of-companies-in-bih'],forms:[
  {name:'Društvo s ograničenom odgovornošću',abbreviation:'d.o.o.'},
  {name:'Dioničko društvo',abbreviation:'d.d.'},
  {name:'Akcionarsko društvo',abbreviation:'a.d.'},
  {name:'Komanditno društvo',abbreviation:'k.d.'},
  {name:'Društvo s neograničenom solidarnom odgovornošću',abbreviation:'d.n.o.'},
  {name:'Ortačko društvo',abbreviation:'o.d.'},
 ]},
 MD:{sources:['Loi n° 135/2007 (SRL) ; liste des formes enregistrées par l’Agenția Servicii Publice reprise par Infoproff (source secondaire), https://www.infoproff.com/en/open-data/moldova/231/business-register-in-moldova'],forms:[
  {name:'Societate cu răspundere limitată',abbreviation:'SRL'},
  {name:'Societate pe acțiuni',abbreviation:'SA',verified:false},
  {name:'Societate în nume colectiv',abbreviation:'SNC',verified:false},
  {name:'Societate în comandită',abbreviation:'SC',verified:false},
  {name:'Cooperativă de producție',verified:false},
  {name:'Cooperativă de întreprinzător',verified:false},
  {name:'Întreprinzător individual',abbreviation:'ÎI',verified:false},
 ]},
 GE:{sources:['Loi géorgienne sur les entrepreneurs (n° 875, 2021), art. 2 et 16, https://matsne.gov.ge/en/document/view/5230186'],forms:[
  {name:'შეზღუდული პასუხისმგებლობის საზოგადოება',abbreviation:'შპს',transliteration:'Limited Liability Company (LLC)'},
  {name:'სააქციო საზოგადოება',abbreviation:'სს',transliteration:'Joint-Stock Company (JSC)'},
  {name:'სოლიდარული პასუხისმგებლობის საზოგადოება',abbreviation:'სპს',transliteration:'General Partnership'},
  {name:'კომანდიტური საზოგადოება',abbreviation:'კს',transliteration:'Limited Partnership'},
  {name:'კოოპერატივი',transliteration:'Cooperative'},
  {name:'ინდივიდუალური მეწარმე',abbreviation:'ი/მ',transliteration:'Individual Entrepreneur'},
 ]},
 EG:{sources:['Loi n° 159 de 1981, art. 1 (SA, commandite par actions, SARL, société unipersonnelle), https://eg.andersen.com/wp-content/uploads/2025/07/Law-No.-159-of-1981.pdf','Sociétés de personnes (Code de commerce) : source secondaire, https://webiis06.mondaq.com/Article/856158'],forms:[
  {name:'شركة مساهمة',transliteration:'Joint Stock Company (S.A.E.)'},
  {name:'شركة توصية بالأسهم',transliteration:'Partnership Limited by Shares'},
  {name:'شركة ذات مسئولية محدودة',transliteration:'Limited Liability Company (LLC)'},
  {name:'شركة الشخص الواحد',transliteration:'Single-Person Company'},
  {name:'شركة تضامن',transliteration:'General Partnership',verified:false},
  {name:'شركة توصية بسيطة',transliteration:'Limited Partnership',verified:false},
 ]},
};

type ElfData=Record<string,([string]|[string,string]|[string,string,string])[]>;
let elf:Promise<ElfData>|null=null;
/** Loads the suggestions of one country. The ISO 20275 data is fetched on first use only. */
export async function legalFormsFor(country:string):Promise<LegalForm[]>{
 if(!country)return [];
 const researched=researchedForms[country];
 if(researched)return [...researched.forms];
 elf??=import('./legal-forms-elf.json').then(m=>m.default as unknown as ElfData);
 const rows=(await elf)[country]||[];
 return rows.map(([name,abbreviation,transliteration])=>({name,...(abbreviation?{abbreviation}:{}),...(transliteration?{transliteration}:{})}));
}
/** The value written in the field: the local name, followed by its abbreviation. */
export const legalFormValue=(form:LegalForm)=>form.abbreviation?`${form.name} (${form.abbreviation})`:form.name;
