import * as THREE from 'three';
const Y=new THREE.Vector3(0,1,0);
const rad=THREE.MathUtils.degToRad;
export class CameraRig {
  constructor(root){
    this.root=root;this.nodes={};this.iris=[];this.rest=new Map();this.meshes=[];this.parts={body:[],zoom:[],focus:[],iris:[],glass:[]};
    root.traverse(n=>{
      this.rest.set(n,{p:n.position.clone(),q:n.quaternion.clone(),axis:Y.clone().applyQuaternion(n.quaternion)});
      if(n.name.startsWith('DOF_iris'))this.iris.push(n);
      else if(n.name.startsWith('DOF_'))this.nodes[n.name.replace('DOF_','').replace(/__[rt]$/,'')]=n;
      if(n.isMesh){
        n.material=Array.isArray(n.material)?n.material.map(m=>m.clone()):n.material.clone();
        const mats=Array.isArray(n.material)?n.material:[n.material];
        n.userData.original=mats.map(m=>({opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,emissive:m.emissive?.clone(),emissiveIntensity:m.emissiveIntensity}));
        this.meshes.push(n);
        let a=n, names=[];while(a&&a!==root){names.push(a.name);a=a.parent;}
        const name=names.join(' ');
        const part=/iris|blade/.test(name)?'iris':/g[123]|Glass/.test(name)?'glass':/zoom/.test(name)?'zoom':/focus/.test(name)?'focus':'body';
        n.userData.part=part;this.parts[part].push(n);
        n.userData.shell=/Shell|Ring_/.test(name);
      }
    });
    for(const k of ['zoom','focus','g1','g2','g3'])if(!this.nodes[k])throw new Error(`Missing rig joint: ${k}`);
    if(this.iris.length!==9)throw new Error('Expected nine iris blades');
  }
  rotate(n,angle){const r=this.rest.get(n);n.quaternion.copy(r.q).multiply(new THREE.Quaternion().setFromAxisAngle(Y,angle));}
  slide(n,d){const r=this.rest.get(n);n.position.copy(r.p).addScaledVector(r.axis,d);}
  apply(s){
    // Always derive transforms from rest, never accumulate previous-frame deltas.
    for(const [n,r] of this.rest){n.position.copy(r.p);n.quaternion.copy(r.q);}
    this.rotate(this.nodes.zoom,rad(55*s.zoom));this.rotate(this.nodes.focus,rad(80*s.focus));
    this.slide(this.nodes.g1,.006*s.zoom);this.slide(this.nodes.g2,.010*s.zoom);this.slide(this.nodes.g3,-.005*s.focus);
    for(const n of this.iris)this.rotate(n,rad(65*s.aperture));
    // Root-level groups move along the optical (+X) axis. Iris members move
    // together to preserve their geometry; local DOF motion remains intact.
    const offsets={Shell_body:.017,Glass_front:.10,Glass_rear:.008,DOF_zoom__r:.036,DOF_focus__r:.083,DOF_g1__t:.042,DOF_g2__t:.060,DOF_g3__t:.078,Shell_cam:-.035,Glass_vf:-.035,REST_dial:-.035};
    for(const n of this.root.children){
      n.position.x+=(n.name.startsWith('DOF_iris')?.018:(offsets[n.name]??0))*s.explode;
    }
    this.root.updateMatrixWorld(true);
  }
  appearance(mode,selected){
    for(const n of this.meshes){
      const mats=Array.isArray(n.material)?n.material:[n.material];
      mats.forEach((m,i)=>{
        const o=n.userData.original[i], transparent=mode==='xray'&&(n.userData.shell||n.name.startsWith('Glass')||(selected==='iris'&&n.userData.part==='glass'));
        m.opacity=transparent?.12:o.opacity;m.transparent=transparent||o.transparent;m.depthWrite=transparent?false:o.depthWrite;m.wireframe=mode==='wire';
        if(m.emissive){m.emissive.copy(o.emissive);m.emissiveIntensity=o.emissiveIntensity;if(selected&&selected!=='body'&&n.userData.part===selected){m.emissive.set('#d86827');m.emissiveIntensity=.22;}}
        m.needsUpdate=true;
      });
    }
  }
}
