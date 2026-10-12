/** Integration point for an operator-configured analytics listener. No text, files or identity are emitted. */
export type JourneyEvent='search_results'|'product_opened'|'comparison_added'|'requirement_step'|'qualified_request_saved';
export function trackJourney(event:JourneyEvent,dimensions:Record<string,string|number|boolean>={}){
 if(typeof window==='undefined')return;
 window.dispatchEvent(new CustomEvent('gsl:journey',{detail:{event,...dimensions}}));
}
