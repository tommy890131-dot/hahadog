import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { PHYSICS, stepVertical } from '../../../../packages/shared/VerticalCollision.mjs';
import {metroStepVertical} from '../../../../v313/MetroMap.mjs';
import type { World } from '../world/World';

/** Fixed-height first-person capsule, with grounded-only jump and shared 3-D collision. */
export class FirstPersonController {
  readonly controls: PointerLockControls;
  private keys=new Set<string>();
  private velocityXZ=new THREE.Vector2();
  private lookSensitivity=.45;
  private lookDX=0;
  private lookDY=0;
  readonly eyeHeight=PHYSICS.eyeHeight;
  velocityY=0;
  isGrounded=true;
  private pendingJump=false;
  moving=false;
  sprinting=false;
  speedMultiplier=1;

  constructor(private camera:THREE.PerspectiveCamera,canvas:HTMLCanvasElement,
    private world:World){
    this.controls=new PointerLockControls(camera,canvas);
    this.setLookSensitivity(.45);
    this.controls.minPolarAngle=.15;
    this.controls.maxPolarAngle=Math.PI-.15;
    this.camera.position.set(0,this.eyeHeight,5.5);
    window.addEventListener('keydown',e=>{
      if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft'].includes(e.code))e.preventDefault();
      if(e.code==='Space'&&!e.repeat&&this.controls.isLocked&&this.isGrounded){
        this.velocityY=PHYSICS.jumpVelocity;
        this.isGrounded=false;
        this.pendingJump=true;
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>{this.keys.clear();this.velocityXZ.set(0,0);});
    this.controls.addEventListener('unlock',()=>{
      this.keys.clear();this.lookDX=this.lookDY=0;
      this.pendingJump=false;this.velocityXZ.set(0,0);
    });
    document.addEventListener('mousemove',e=>{
      if(!this.controls.isLocked)return;
      this.lookDX+=e.movementX*this.lookSensitivity;this.lookDY+=e.movementY*this.lookSensitivity;
    });
  }

  /** PointerLockControls default mouse factor is 1.0; 0.45 is more controllable. */
  setLookSensitivity(value:number):void{
    this.lookSensitivity=THREE.MathUtils.clamp(Number.isFinite(value)?value:.45,.15,1);
    this.controls.pointerSpeed=this.lookSensitivity;
  }
  get sensitivity():number{return this.lookSensitivity;}
  get footY():number{return this.camera.position.y-this.eyeHeight;}
  consumeJump():boolean{const jump=this.pendingJump;this.pendingJump=false;return jump;}
  consumeLook():[number,number]{
    const pair:[number,number]=[this.lookDX,this.lookDY];this.lookDX=this.lookDY=0;
    return pair;
  }
  teleport(x:number,z:number,feet=0):void{
    this.camera.position.set(x,feet+this.eyeHeight,z);
    this.velocityY=0;this.isGrounded=true;this.pendingJump=false;this.velocityXZ.set(0,0);
  }
  /** The server computes vertical position independently; correct drift, never accept client Y. */
  reconcileServerHeight(feet:number,grounded:boolean,serverVy=0):void{
    if(!Number.isFinite(feet))return;
    const diff=feet-this.footY;
    if(Math.abs(diff)>1.55){
      // Large disagreement is a real desync/teleport; recover instantly.
      this.camera.position.y=feet+this.eyeHeight;
      this.velocityY=Number.isFinite(serverVy)?serverVy:0;
      this.isGrounded=grounded;
    }else if(Math.abs(diff)>.70 && grounded && this.isGrounded && !this.moving){
      // Never chase a 100ms-old server snapshot during a local jump/ramp walk.
      this.camera.position.y+=diff*.10;
    }
  }

  update(dt:number):void{
    this.moving=false;this.sprinting=false;
    if(!this.controls.isLocked)return;
    const step=Math.min(Math.max(dt,0),.05);
    const forward=new THREE.Vector3();
    this.controls.getDirection(forward);forward.y=0;forward.normalize();
    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    const move=new THREE.Vector3();
    if(this.keys.has('KeyW'))move.add(forward);
    if(this.keys.has('KeyS'))move.sub(forward);
    if(this.keys.has('KeyD'))move.add(right);
    if(this.keys.has('KeyA'))move.sub(right);
    const pos=this.camera.position;
    let feet=this.footY;
    this.moving=move.lengthSq()>.001;
    this.sprinting=this.moving && this.keys.has('ShiftLeft');
    const desiredSpeed=(this.sprinting?7.5:4.8)*this.speedMultiplier;
    if(this.moving)move.normalize().multiplyScalar(desiredSpeed);
    // Exponential acceleration/deceleration independent of render FPS.
    const blend=1-Math.exp(-(this.moving?15:20)*step);
    this.velocityXZ.x+=(move.x-this.velocityXZ.x)*blend;
    this.velocityXZ.y+=(move.z-this.velocityXZ.y)*blend;
    if(!this.moving&&this.velocityXZ.lengthSq()<.0025)this.velocityXZ.set(0,0);
    const speed=this.velocityXZ.length();
    if(this.moving&&speed>desiredSpeed&&desiredSpeed>0)this.velocityXZ.multiplyScalar(desiredSpeed/speed);
    if(this.velocityXZ.lengthSq()>.0001){
      const dx=this.velocityXZ.x*step,dz=this.velocityXZ.y*step;
      const resolved=this.world.movePlayer(pos.x,pos.z,feet,dx,dz,this.isGrounded);
      // Don't keep pushing velocity into a wall and causing micro-jitter.
      if(Math.abs(resolved.x-pos.x)<Math.abs(dx)*.12)this.velocityXZ.x=0;
      if(Math.abs(resolved.z-pos.z)<Math.abs(dz)*.12)this.velocityXZ.y=0;
      pos.x=resolved.x;pos.z=resolved.z;feet=resolved.feet;
    }
    const vertical=this.world.chapter==='underground_metro'
      ?metroStepVertical(feet,this.velocityY,this.isGrounded,pos.x,pos.z,step)
      :stepVertical(feet,this.velocityY,this.isGrounded,pos.x,pos.z,step);
    this.velocityY=vertical.vy;
    this.isGrounded=vertical.grounded;
    pos.y=vertical.y+this.eyeHeight;
  }
}
