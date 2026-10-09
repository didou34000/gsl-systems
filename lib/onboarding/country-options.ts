import {sourcingCountries} from '../sourcing-coverage';
/** Commercial supplier scope, independent of ISO validation for legacy drafts and buyer countries. */
export const availableCountries:readonly string[]=sourcingCountries;
export const countryGroups=[{en:'GSL sourcing countries',fr:'Pays de sourcing GSL',codes:sourcingCountries}];
