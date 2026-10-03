import {expect,it} from 'vitest';import {readEnd} from './read-range.ts';
it('continues from scanned source slots even when one detail was unavailable',()=>{
 expect(readEnd({offset:0,received:1999,scanned:2000,knownTotal:2301,complete:false,limitReason:'missing-details'})).toBe(2000);
 expect(readEnd({offset:1000,received:500,knownTotal:2000,complete:false})).toBe(1500);
});
