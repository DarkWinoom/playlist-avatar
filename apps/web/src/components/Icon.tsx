import type { SVGProps } from 'react';
import{iconData}from'./icon-data.ts';

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: 'settings' | 'grid' | keyof typeof iconData }) {
  if(name!=='settings'&&name!=='grid')return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props} dangerouslySetInnerHTML={{__html:iconData[name]}}/>;
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
    {name === 'settings' ? <><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></>
      : <>{[[3, 3], [14, 3], [14, 14], [3, 14]].map(([x, y], index) => <rect key={index} x={x} y={y} width="7" height="7" rx="1" />)}</>}
  </svg>;
}
