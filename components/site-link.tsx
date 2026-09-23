import type {ComponentProps} from 'react';
// Native navigation works in both the local renderer and the deployed Worker.
// Temporary comparison choices are restored by Marketplace after navigation.
export default function SiteLink(props:ComponentProps<'a'>){return <a {...props}/>}
