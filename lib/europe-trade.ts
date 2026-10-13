/**
 * How each European country outside the GSL sourcing scope trades with the EU.
 * Display only: these countries are not part of supplier registration (see sourcing-coverage).
 * Dates are entry into force; reviewed with sourcing-agreements on the same day.
 */
export type EuropeStatus='eu'|'eea'|'switzerland'|'uk'|'dcfta'|'saa'|'customs'|'customs-territory'|'none'|'sanctions';
export type EuropeCountry={code:string;status:EuropeStatus;since?:string;provisional?:string};
const member=(since:string,...codes:string[])=>codes.map(code=>({code,status:'eu' as const,since}));
export const europeCountries:EuropeCountry[]=[
 ...member('1958-01-01','BE','DE','FR','IT','LU','NL'),
 ...member('1973-01-01','DK','IE'),
 ...member('1981-01-01','GR'),
 ...member('1986-01-01','ES','PT'),
 ...member('1995-01-01','AT','FI','SE'),
 ...member('2004-05-01','CY','CZ','EE','HU','LV','LT','MT','PL','SK','SI'),
 ...member('2007-01-01','BG','RO'),
 ...member('2013-07-01','HR'),
 {code:'NO',status:'eea',since:'1994-01-01'},{code:'IS',status:'eea',since:'1994-01-01'},{code:'LI',status:'eea',since:'1995-05-01'},
 {code:'CH',status:'switzerland',since:'1973-01-01'},
 {code:'GB',status:'uk',since:'2021-05-01',provisional:'2021-01-01'},
 {code:'UA',status:'dcfta',since:'2017-09-01',provisional:'2016-01-01'},
 {code:'ME',status:'saa',since:'2010-05-01',provisional:'2008-01-01'},
 {code:'XK',status:'saa',since:'2016-04-01'},
 {code:'AD',status:'customs',since:'1991-07-01'},{code:'SM',status:'customs',since:'2002-04-01'},
 {code:'MC',status:'customs-territory'},
 {code:'VA',status:'none'},
 {code:'BY',status:'sanctions'},{code:'RU',status:'sanctions'},
];
export function europeCountry(code:string){return europeCountries.find(c=>c.code===code);}
export const europeStatusText:Record<EuropeStatus,{title:[string,string];since?:[string,string];note:[string,string]}>={
 eu:{title:['European Union member state','État membre de l’Union européenne'],since:['Member since','Membre depuis'],note:['Goods move within the single market without customs duties or customs formalities. Product rules such as CE marking are harmonised across the EU.','Les marchandises circulent dans le marché unique sans droits ni formalités de douane. Les règles produit, comme le marquage CE, sont harmonisées dans toute l’UE.']},
 eea:{title:['European Economic Area (EEA)','Espace économique européen (EEE)'],since:['In the EEA since','Dans l’EEE depuis'],note:['Part of the single market for goods through the EEA, but outside the EU customs union. Customs declarations and rules of origin still apply.','Intégré au marché unique des marchandises par l’EEE, mais hors de l’union douanière de l’UE. Déclarations en douane et règles d’origine restent applicables.']},
 switzerland:{title:['EU–Switzerland Free Trade Agreement','Accord de libre-échange UE–Suisse'],since:['In force since','En vigueur depuis'],note:['Industrial goods of preferential origin cross without customs duties. Switzerland is outside the customs union, so a customs declaration and proof of origin are required.','Les produits industriels d’origine préférentielle passent sans droits de douane. La Suisse est hors de l’union douanière : déclaration en douane et preuve d’origine sont requises.']},
 uk:{title:['EU–UK Trade and Cooperation Agreement','Accord de commerce et de coopération UE–Royaume-Uni'],since:['In force since','En vigueur depuis'],note:['No tariffs or quotas on goods that meet the rules of origin. Since 2021, customs declarations and checks apply in both directions.','Ni droits ni quotas sur les marchandises qui respectent les règles d’origine. Depuis 2021, déclarations et contrôles douaniers s’appliquent dans les deux sens.']},
 dcfta:{title:['Association Agreement and DCFTA','Accord d’association et ALEAC'],since:['In force since','En vigueur depuis'],note:['The DCFTA removes most customs duties on originating industrial goods. Check the current conditions for the exact product before ordering.','L’ALEAC supprime la plupart des droits de douane sur les produits industriels originaires. Vérifiez les conditions actuelles pour le produit exact avant de commander.']},
 saa:{title:['Stabilisation and Association Agreement (SAA)','Accord de stabilisation et d’association (ASA)'],since:['In force since','En vigueur depuis'],note:['Industrial goods of preferential origin enter the EU without customs duties. A proof of origin is required at import.','Les produits industriels d’origine préférentielle entrent dans l’UE sans droits de douane. Une preuve d’origine est exigée à l’importation.']},
 customs:{title:['Customs union with the EU','Union douanière avec l’UE'],since:['In force since','En vigueur depuis'],note:['Industrial goods covered by the customs union move without customs duties. The country is not an EU member: customs formalities remain.','Les produits industriels couverts par l’union douanière circulent sans droits de douane. Le pays n’est pas membre de l’UE : des formalités douanières subsistent.']},
 'customs-territory':{title:['Part of the EU customs territory','Intégré au territoire douanier de l’UE'],note:['Monaco is included in the EU customs territory through its customs union with France. Goods move as within France.','Monaco fait partie du territoire douanier de l’UE par son union douanière avec la France. Les marchandises y circulent comme en France.']},
 none:{title:['No trade agreement with the EU','Aucun accord commercial avec l’UE'],note:['The Vatican City State is outside the EU customs territory. It uses the euro under a monetary agreement, which does not cover trade in goods.','L’État de la Cité du Vatican est hors du territoire douanier de l’UE. Il utilise l’euro par un accord monétaire, qui ne couvre pas le commerce de marchandises.']},
 sanctions:{title:['EU restrictive measures','Mesures restrictives de l’UE'],note:['EU sanctions prohibit or restrict imports of many goods from this country. GSL does not source here.','Les sanctions de l’UE interdisent ou limitent l’importation de nombreux produits de ce pays. GSL n’y fait pas de sourcing.']},
};
