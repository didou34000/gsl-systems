// Generates lib/maps/europe.json from Natural Earth 1:50m (world-atlas).
// One-off build tool, not a runtime dependency. Run from a scratch folder with:
//   npm i world-atlas@2.0.2 d3-geo@3 topojson-client@3 topojson-simplify@3 && node <repo>/scripts/build-europe-map.mjs <repo>/lib/maps/europe.json
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/');
const topology=structuredClone(require('world-atlas/countries-50m.json'));
const {merge}=require('topojson-client');
const {presimplify,simplify}=require('topojson-simplify');
const d3=require('d3-geo');
const out=process.argv[2];
const numeric={'008':'AL','020':'AD','040':'AT','056':'BE','070':'BA','100':'BG','112':'BY','191':'HR','196':'CY','203':'CZ','208':'DK','233':'EE','246':'FI','250':'FR','268':'GE','276':'DE','300':'GR','348':'HU','352':'IS','372':'IE','380':'IT','428':'LV','438':'LI','440':'LT','442':'LU','470':'MT','492':'MC','498':'MD','499':'ME','504':'MA','528':'NL','578':'NO','616':'PL','620':'PT','642':'RO','643':'RU','674':'SM','688':'RS','703':'SK','705':'SI','724':'ES','752':'SE','756':'CH','788':'TN','792':'TR','804':'UA','807':'MK','818':'EG','826':'GB','336':'VA'};
const geometries=topology.objects.countries.geometries;
// The EU recognises Crimea as part of Ukraine: move that polygon from Russia to Ukraine.
const russia=geometries.find(g=>g.id==='643'),ukraine=geometries.find(g=>g.id==='804');
const crimeaIndex=russia.arcs.findIndex(arcs=>d3.geoContains(merge(topology,[{type:'Polygon',arcs}]),[34.1,44.95]));
if(crimeaIndex<0)throw Error('Crimea polygon not found');
const crimea=russia.arcs.splice(crimeaIndex,1)[0];
ukraine.arcs=ukraine.type==='Polygon'?[ukraine.arcs,crimea]:[...ukraine.arcs,crimea];ukraine.type='MultiPolygon';
const code=g=>g.properties.name==='Kosovo'?'XK':numeric[g.id];
const groups=new Map();
for(const g of geometries){const c=code(g)||(g.properties.name==='N. Cyprus'?'CY':null)||'_'+(g.id||g.properties.name);if(!groups.has(c))groups.set(c,[]);groups.get(c).push(g);}
// Drop detail below ~0.02 square degrees; borders stay shared so neighbours still meet.
const simplified=simplify(presimplify(topology),0.02);Object.assign(topology,simplified);
const width=1000,height=760;
const projection=d3.geoAzimuthalEqualArea().rotate([-13,-50]).clipExtent([[0,0],[width,height]]);
// Frame: Iceland to the Caucasus, Scandinavia to Egypt.
projection.fitExtent([[8,8],[width-8,height-8]],{type:'MultiPoint',coordinates:[[-24,64.5],[46,43],[30,71],[-13.5,27.5],[25,22],[35,22],[-9,36]]});
const path=d3.geoPath(projection).digits(1);
const countries=[],context=[];
for(const [c,geoms] of groups){
 const shape=merge(topology,geoms);
 const d=path(shape);if(!d)continue;
 if(c.startsWith('_')||!Object.values(numeric).concat('XK').includes(c)){context.push(d);continue;}
 const [cx,cy]=path.centroid(shape);const [[x0,y0],[x1,y1]]=path.bounds(shape);
 countries.push({code:c,path:d,center:[+cx.toFixed(1),+cy.toFixed(1)],area:+((x1-x0)*(y1-y0)).toFixed(0)});
}
// Natural Earth centroids for countries with remote territories are moved to the mainland.
const anchors={FR:[2.5,46.6],NO:[9.5,61.5],RU:[38,56],PT:[-8,39.6],ES:[-3.7,40.3],GR:[22.5,39.4],DK:[9.3,56],NL:[5.6,52.2],IT:[12.5,42.8],HR:[16,45.3],GB:[-1.8,52.8],TR:[33,39.2],EG:[30.5,27],MA:[-6.2,32.2],FI:[26,62.6],SE:[15.2,60.5]};
// Microstates vanish at this scale: they get a point so they stay visible and clickable.
const points={AD:[1.52,42.55],MC:[7.42,43.74],SM:[12.46,43.94],VA:[12.45,41.9],LI:[9.55,47.16],MT:[14.44,35.9],LU:[6.13,49.7]};
for(const [c,lonlat] of Object.entries(points)){const [x,y]=projection(lonlat);const existing=countries.find(x=>x.code===c);const center=[+x.toFixed(1),+y.toFixed(1)];if(existing){existing.center=center;existing.point=true;}else countries.push({code:c,path:'',center,area:0,point:true});}
for(const c of countries){if(anchors[c.code]){const [x,y]=projection(anchors[c.code]);c.center=[+x.toFixed(1),+y.toFixed(1)];}}
fs.writeFileSync(out,JSON.stringify({width,height,source:'Natural Earth 1:50m via world-atlas 2.0.2',countries,context:context.join('')}));
console.log(countries.length,'countries',(fs.statSync(out).size/1024).toFixed(0)+'KB');
