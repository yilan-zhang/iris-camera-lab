export const DEFAULTS = Object.freeze({zoom:0, focus:0, aperture:0, explode:0, mode:'solid', view:'hero'});
export const clamp = (v, lo=0, hi=1) => Number.isFinite(Number(v)) ? Math.min(hi,Math.max(lo,Number(v))) : lo;
export function normalize(s={}) {
  return {...DEFAULTS, ...Object.fromEntries(['zoom','focus','aperture','explode'].map(k=>[k,clamp(s[k]??0)])), mode:['solid','xray','wire'].includes(s.mode)?s.mode:'solid',view:['hero','front','side','rear'].includes(s.view)?s.view:'hero'};
}
export function fromHash(hash) {return normalize(Object.fromEntries(new URLSearchParams(hash.replace(/^#/,''))));}
export function toHash(s) {const n=normalize(s);return new URLSearchParams(Object.entries(n).map(([k,v])=>[k,typeof v==='number'?v.toFixed(3):v])).toString();}
export function metrics(s) {
  const zoom=clamp(s.zoom), aperture=clamp(s.aperture);
  const focal=24+zoom*46;
  const radius=0.0245*Math.cos(aperture*65*Math.PI/180)-0.008;
  const fNumber=2.8*0.0165/radius;
  return {focal, fNumber, fieldOfView:2*Math.atan(36/(2*focal))*180/Math.PI, light:Math.pow(2.8/fNumber,2), radius};
}
export const PRESETS={
  wide:{zoom:0,focus:.15,aperture:.48},
  portrait:{zoom:.78,focus:.65,aperture:0},
  detail:{zoom:1,focus:1,aperture:.76},
};
