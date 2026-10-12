import {z} from 'zod';
import {roboticsMetrics} from './robotics';
import {isSourcingCountry} from './sourcing-coverage';
export const searchSchema=z.object({
 q:z.string().trim().max(120).default(''),process:z.string().trim().max(80).default(''),material:z.string().trim().max(80).default(''),
 country:z.string().refine(c=>!c||isSourcingCountry(c),'COUNTRY_OUTSIDE_SCOPE').default(''),category:z.string().max(80).default(''),
 quantity:z.string().regex(/^(?:\d{1,12}(?:\.\d{1,4})?)?$/).default(''),unit:z.enum(['','pcs','kg','m','m2','set']).default(''),
 priority:z.enum(['required','preferred']).default('required'),unknown:z.enum(['exclude','include']).default('exclude'),
 metric:z.string().refine(v=>!v||Object.values(roboticsMetrics).flat().some(m=>m.key===v)).default(''),
 minimum:z.string().regex(/^(?:\d{1,12}(?:\.\d{1,6})?)?$/).default(''),maximum:z.string().regex(/^(?:\d{1,12}(?:\.\d{1,6})?)?$/).default(''),connection:z.string().trim().max(80).default(''),
 page:z.coerce.number().int().min(1).max(10000).default(1),
}).strict().superRefine((x,c)=>{if((x.minimum||x.maximum)&&(!x.category||!(roboticsMetrics[x.category]||[]).some(m=>m.key===x.metric)))c.addIssue({code:'custom',path:['metric'],message:'Choose a metric for this robotics family'});if(x.minimum&&x.maximum&&Number(x.minimum)>Number(x.maximum))c.addIssue({code:'custom',path:['maximum'],message:'Maximum must be at least the minimum'});if(x.quantity&&(!x.unit||Number(x.quantity)<=0))c.addIssue({code:'custom',path:['quantity'],message:'A positive quantity and an explicit unit are required'});});
export type SearchCriteria=z.infer<typeof searchSchema>;
// Editorial aliases only. No inferred quantities, destinations or certifications.
export function normalizedQuery(q:string){return q.toLowerCase().replace(/usinage|machining/g,'cnc').replace(/aluminum/g,'aluminium').replace(/soudage|welding/g,'weld').replace(/acier inoxydable|stainless steel/g,'inox');}
