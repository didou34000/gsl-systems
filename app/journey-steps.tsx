'use client';
import {Check} from 'lucide-react';
import {useLanguage} from './language';
import {journeySteps,type Purpose} from '@/lib/onboarding/journey';

/** Progress through the registration journey: a bar, "Step x of y" and the named steps. */
export default function JourneySteps({purpose,current}:{purpose:Purpose;current:number}){
 const {l}=useLanguage();
 const steps=journeySteps[purpose];
 const position=Math.min(current,steps.length-1);
 return <div className="ob-progress">
  <p className="ob-progress-label"><span>{l('Step','Étape')} {position+1} {l('of','sur')} {steps.length}</span><strong>{l(...steps[position])}</strong></p>
  <div className="ob-progress-bar" role="progressbar" aria-label={l('Registration progress','Progression de l’inscription')} aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={position+1}><span style={{width:`${(position+1)/steps.length*100}%`}}/></div>
  <ol className="ob-steps">{steps.map((step,i)=><li key={step[0]} className={i<position?'done':i===position?'current':''} aria-current={i===position?'step':undefined}><span className="ob-step-mark" aria-hidden>{i<position?<Check size={13}/>:null}</span>{l(...step)}</li>)}</ol>
 </div>;
}
