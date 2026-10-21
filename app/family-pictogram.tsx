/** Thin technical drawings, one per component family, drawn in a 96×72 box. They show a generic part, never a listed product. */
const drawings:Record<string,React.ReactNode>={
 'actionnement-transmission':<>
  <rect x="20" y="22" width="40" height="30" rx="4"/><rect x="60" y="18" width="7" height="38" rx="1.5"/>
  <path d="M67 37h15M28 22v30M35 22v30M42 22v30"/><rect x="30" y="15" width="12" height="7" rx="1.5"/>
  <circle cx="63.5" cy="23" r="1"/><circle cx="63.5" cy="51" r="1"/>
 </>,
 'transmissions-guidages':<>
  <circle cx="48" cy="36" r="25"/><circle cx="48" cy="36" r="19" strokeDasharray="2.2 2"/>
  <circle cx="48" cy="36" r="14"/><circle cx="48" cy="36" r="5"/>
  <circle cx="48" cy="14.5" r="1.4"/><circle cx="48" cy="57.5" r="1.4"/><circle cx="26.5" cy="36" r="1.4"/><circle cx="69.5" cy="36" r="1.4"/>
 </>,
 'capteurs-vision':<>
  <rect x="18" y="24" width="60" height="26" rx="5"/><circle cx="35" cy="37" r="8"/><circle cx="35" cy="37" r="3.5"/>
  <circle cx="61" cy="37" r="8"/><circle cx="61" cy="37" r="3.5"/><circle cx="48" cy="31" r="1.4"/>
  <path d="M48 50v8q0 4 4 4h14"/>
 </>,
 'commande-electronique':<>
  <rect x="16" y="14" width="64" height="44" rx="3"/><rect x="38" y="25" width="20" height="20" rx="1.5"/>
  <path d="M41 25v-4M46 25v-4M51 25v-4M55 25v-4M41 45v4M46 45v4M51 45v4M55 45v4M38 30h-4M38 35h-4M38 40h-4M58 30h4M58 35h4M58 40h4"/>
  <path d="M62 35h8v-12M26 24v10h8M66 50h8"/>
  <circle cx="21" cy="19" r="1.8"/><circle cx="75" cy="19" r="1.8"/><circle cx="21" cy="53" r="1.8"/><circle cx="75" cy="53" r="1.8"/>
 </>,
 'cables-connecteurs':<>
  <path d="M10 56c22 0 20-34 42-34h8M10 62c26 0 24-34 46-34h4"/>
  <rect x="60" y="16" width="20" height="18" rx="2"/><path d="M80 20h6M80 25h6M80 30h6"/>
  <rect x="56" y="18" width="4" height="14" rx="1"/>
 </>,
 'energie-batteries':<>
  <rect x="16" y="22" width="64" height="32" rx="4"/><rect x="24" y="16" width="10" height="6" rx="1"/><rect x="62" y="16" width="10" height="6" rx="1"/>
  <path d="M32 22v32M48 22v32M64 22v32M26 38h4M28 36v4M64.5 38h4"/>
 </>,
 prehension:<>
  <rect x="32" y="10" width="32" height="10" rx="2"/><rect x="38" y="20" width="20" height="14" rx="2"/>
  <path d="M42 34v10l-6 12h6l6-10M54 34v10l6 12h-6l-6-10"/><path d="M38 27h-4M58 27h4"/>
 </>,
 'pieces-mecaniques':<>
  <path d="M18 56h60V44H34V16H18z"/><circle cx="26" cy="24" r="2.6"/><circle cx="26" cy="36" r="2.6"/>
  <circle cx="50" cy="50" r="2.6"/><circle cx="66" cy="50" r="2.6"/><path d="M34 44l-6 6" strokeDasharray="2 2"/>
 </>,
};

export default function FamilyPictogram({family}:{family:string}){
 const drawing=drawings[family];
 if(!drawing)return null;
 return <svg className="family-pictogram" viewBox="0 0 96 72" aria-hidden focusable="false">{drawing}</svg>;
}
