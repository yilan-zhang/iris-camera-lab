import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,normalize,fromHash,toHash,metrics} from '../src/state.js';
test('untrusted URL parameters are bounded and unknown modes ignored',()=>{
  assert.deepEqual(fromHash('#zoom=Infinity&focus=-4&aperture=9&explode=oops&mode=invalid&view=bad'),{...DEFAULTS,aperture:1});
});
test('shared configurations survive a roundtrip',()=>{
  const s={zoom:.831,focus:.432,aperture:.222,explode:.6,mode:'xray',view:'side'};
  assert.deepEqual(fromHash(toHash(s)),s);
});
test('longer focal lengths narrow field of view',()=>{
  const wide=metrics(DEFAULTS),tight=metrics({...DEFAULTS,zoom:1});
  assert.ok(Math.abs(wide.fieldOfView-73.7398)<.001);assert.ok(tight.fieldOfView<wide.fieldOfView);
});
test('closing the iris continuously reduces opening and light without singularities',()=>{
  let last=Infinity;
  for(let i=0;i<=100;i++){const m=metrics({...DEFAULTS,aperture:i/100});assert.ok(m.radius>0);assert.ok(m.light<=last);assert.ok(Number.isFinite(m.fNumber));last=m.light;}
  assert.equal(metrics(DEFAULTS).light,1);
});
