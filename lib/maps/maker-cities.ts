import europe from './europe.json';
/**
 * Places manufacturers on lib/maps/europe.json without a geocoding service.
 * Same projection as scripts/build-europe-map.mjs: azimuthal equal-area centred on 13°E 50°N,
 * scale and offset solved from two of its anchors (France, Turkey); other anchors match to 0.1 px.
 */
const R=Math.PI/180,lambda0=13*R,phi0=50*R,scale=879.4519,offsetX=501.3706,offsetY=339.092;
export function projectToEuropeMap(lon:number,lat:number):[number,number]{
 const l=lon*R-lambda0,p=lat*R,cosC=Math.sin(phi0)*Math.sin(p)+Math.cos(phi0)*Math.cos(p)*Math.cos(l),k=Math.sqrt(2/(1+cosC));
 const x=k*Math.cos(p)*Math.sin(l),y=k*(Math.cos(phi0)*Math.sin(p)-Math.sin(phi0)*Math.cos(p)*Math.cos(l));
 return [+(offsetX+scale*x).toFixed(1),+(offsetY-scale*y).toFixed(1)];
}
/** City centres (longitude, latitude), rounded to about 5 km, for the industrial cities of the sourcing countries. */
const cities:Record<string,Record<string,[number,number]>>={
 TR:{istanbul:[28.98,41.01],ankara:[32.85,39.93],izmir:[27.14,38.42],bursa:[29.06,40.19],kocaeli:[29.92,40.77],izmit:[29.92,40.77],gebze:[29.43,40.8],konya:[32.49,37.87],kapakli:[27.98,41.33],tekirdag:[27.51,40.98],corlu:[27.8,41.16],kayseri:[35.49,38.73],gaziantep:[37.38,37.07],eskisehir:[30.52,39.78],manisa:[27.43,38.61],denizli:[29.09,37.78],sakarya:[30.4,40.78],adapazari:[30.4,40.78],antalya:[30.71,36.9],adana:[35.32,37],samsun:[36.33,41.29],trabzon:[39.72,41]},
 MA:{casablanca:[-7.59,33.57],rabat:[-6.84,34.02],tanger:[-5.81,35.77],tangier:[-5.81,35.77],kenitra:[-6.58,34.26],fes:[-5,34.03],marrakech:[-8.01,31.63],agadir:[-9.6,30.43],meknes:[-5.55,33.9],mohammedia:[-7.38,33.69],oujda:[-1.91,34.68],tetouan:[-5.37,35.57]},
 TN:{tunis:[10.18,36.81],sousse:[10.64,35.83],sfax:[10.76,34.74],bizerte:[9.87,37.27],nabeul:[10.74,36.45],monastir:[10.83,35.78],'ben arous':[10.23,36.75],ariana:[10.19,36.86],gabes:[10.1,33.88],kairouan:[10.1,35.68]},
 RS:{belgrade:[20.46,44.82],beograd:[20.46,44.82],'novi sad':[19.84,45.27],nis:[21.9,43.32],kragujevac:[20.91,44.01],subotica:[19.67,46.1],cacak:[20.35,43.89]},
 MK:{skopje:[21.43,42],bitola:[21.33,41.03],tetovo:[20.97,42.01],stip:[22.2,41.74],kumanovo:[21.71,42.13],prilep:[21.55,41.35]},
 BA:{sarajevo:[18.41,43.86],'banja luka':[17.19,44.77],mostar:[17.81,43.34],tuzla:[18.67,44.54],zenica:[17.91,44.2],bihac:[15.87,44.82]},
 MD:{chisinau:[28.86,47.01],balti:[27.93,47.76],tiraspol:[29.64,46.84],cahul:[28.19,45.9]},
 GE:{tbilisi:[44.79,41.72],kutaisi:[42.7,42.27],batumi:[41.64,41.64],rustavi:[45,41.55],poti:[41.67,42.15]},
 AL:{tirana:[19.82,41.33],tirane:[19.82,41.33],durres:[19.45,41.32],shkoder:[19.51,42.07],elbasan:[20.08,41.11],vlore:[19.49,40.47],korce:[20.78,40.62]},
 EG:{cairo:[31.24,30.04],'le caire':[31.24,30.04],alexandria:[29.92,31.2],alexandrie:[29.92,31.2],giza:[31.21,30.01],'10th of ramadan':[31.74,30.3],'port said':[32.3,31.26],suez:[32.55,29.97],'6th of october':[30.93,29.94],'sadat city':[30.53,30.37]},
};
/** "Kapaklı (Tekirdağ)" → "kapakli": accents, dotless i, region in brackets or after a comma are ignored. */
export const cityKey=(city:string)=>city.replace(/[ıİ]/g,'i').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().split(/[(,/]/)[0].replace(/[-‐]/g,' ').replace(/\s+/g,' ').trim();
export type MapPoint={x:number;y:number;precision:'city'|'country'};
const centres=new Map(europe.countries.map(c=>[c.code,c.center as number[]]));
/** City position when the city is known, otherwise the country's centre; null outside the map. */
export function makerPoint(country:string,city?:string|null):MapPoint|null{
 const known=city?cities[country]?.[cityKey(city)]:undefined;
 if(known){const [x,y]=projectToEuropeMap(known[0],known[1]);return {x,y,precision:'city'};}
 const centre=centres.get(country);return centre?{x:centre[0],y:centre[1],precision:'country'}:null;
}
