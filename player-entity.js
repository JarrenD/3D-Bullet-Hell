import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';

import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/FBXLoader.js';

import {entity} from './entity.js';
import {finite_state_machine} from './finite-state-machine.js';
import {player_state} from './player-state.js';
import { Bullet } from './bullet.js';


export const player_entity = (() => {

  class CharacterFSM extends finite_state_machine.FiniteStateMachine {
    constructor(proxy) {
      super();
      this._proxy = proxy;
      this._Init();
      
    }
  
    _Init() {
      this._AddState('idle', player_state.IdleState);
      this._AddState('walk', player_state.WalkState);
      this._AddState('run', player_state.RunState);
      this._AddState('attack', player_state.AttackState);
      this._AddState('death', player_state.DeathState);
    }
  };
  
  class BasicCharacterControllerProxy {
    constructor(animations) {
      this._animations = animations;
    }
  
    get animations() {
      return this._animations;
    }
  };

  function calculateDistance(x1, z1, x2, z2) {
    const xDifference = x2 - x1;
    const zDifference = z2 - z1;
    return Math.sqrt(xDifference * xDifference + zDifference * zDifference);
  }


  // Function to calculate the tangential direction of the circle at the current position
function calculateTangentialDirection(centerX, centerZ, posX, posZ, direction) {
    const dx = posX - centerX;
    const dz = posZ - centerZ;
  
    // Tangential vector perpendicular to the radius
    if (direction === 'left') {
      return { x: -dz, z: dx }; // Rotate 90 degrees counter-clockwise
    } else if (direction === 'right') {
      return { x: dz, z: -dx }; // Rotate 90 degrees clockwise
    }
  }

  class BasicCharacterController extends entity.Component {
    constructor(params) {
      super();
      this._Init(params);
    }

    _Init(params) {
      this._params = params;
      this._decceleration = new THREE.Vector3(-5, -9.8, -5.0);
      this._acceleration = new THREE.Vector3(80, 1000, 50.0);
      this._velocity = new THREE.Vector3(0, 0, 0);
      this._position = new THREE.Vector3();

      this._bullets = [];
      this._lastBulletTime = 0; // Time when the last bullet was fired
      this._bulletCooldown = 0.2; // Cooldown in seconds

      this._currentlyJumping = false;
      this._theta = 0;
      this._centerPoint = new THREE.Vector3(0, 0, 40); // Center of the circular path

      this._animations = {};
      this._stateMachine = new CharacterFSM(
          new BasicCharacterControllerProxy(this._animations));
  
      this._LoadModels();
    }

    InitComponent() {
      this._RegisterHandler('health.death', (m) => { this._OnDeath(m); });
    }

    _OnDeath(msg) {
      this._stateMachine.SetState('death');
    }

    _LoadModels() {
      const loader = new FBXLoader();
      loader.setPath('./resources/guard/');
      loader.load('castle_guard_01.fbx', (fbx) => {
        this._target = fbx;
        this._target.scale.setScalar(0.035);
        this._params.scene.add(this._target);
  
        this._bones = {};

        for (let b of this._target.children[1].skeleton.bones) {
          this._bones[b.name] = b;
        }

        this._target.traverse(c => {
          c.castShadow = true;
          c.receiveShadow = true;
          if (c.material && c.material.map) {
            c.material.map.encoding = THREE.sRGBEncoding;
          }
        });

        this.Broadcast({
            topic: 'load.character',
            model: this._target,
            bones: this._bones,
        });

        this._mixer = new THREE.AnimationMixer(this._target);

        const _OnLoad = (animName, anim) => {
          const clip = anim.animations[0];
          const action = this._mixer.clipAction(clip);
    
          this._animations[animName] = {
            clip: clip,
            action: action,
          };
        };

        this._manager = new THREE.LoadingManager();
        this._manager.onLoad = () => {
          this._stateMachine.SetState('idle');
        };
  
        const loader = new FBXLoader(this._manager);
        loader.setPath('./resources/guard/');
        loader.load('Sword And Shield Idle.fbx', (a) => { _OnLoad('idle', a); });
        loader.load('Sword And Shield Run.fbx', (a) => { _OnLoad('run', a); });
        loader.load('Sword And Shield Walk.fbx', (a) => { _OnLoad('walk', a); });
        loader.load('Sword And Shield Slash.fbx', (a) => { _OnLoad('attack', a); });
        loader.load('Sword And Shield Death.fbx', (a) => { _OnLoad('death', a); });
      });
    }

    _FindIntersections(pos) {
      const _IsAlive = (c) => {
        const h = c.entity.GetComponent('HealthComponent');
        if (!h) {
          return true;
        }
        return h._health > 0;
      };

      const grid = this.GetComponent('SpatialGridController');
      const nearby = grid.FindNearbyEntities(5).filter(e => _IsAlive(e));
      const collisions = [];

      for (let i = 0; i < nearby.length; ++i) {
        const e = nearby[i].entity;
        const d = ((pos.x - e._position.x) ** 2 + (pos.z - e._position.z) ** 2) ** 0.5;

        // HARDCODED
        if (d <= 4) {
          collisions.push(nearby[i].entity);
        }
      }
      return collisions;
    }

    Update(timeInSeconds) {
      //console.log('UPDATED');
      if (!this._stateMachine._currentState) {
        return;
      }

      const input = this.GetComponent('BasicCharacterControllerInput');
      this._stateMachine.Update(timeInSeconds, input);

      if (this._mixer) {
        this._mixer.update(timeInSeconds);
      }

      // HARDCODED
      if (this._stateMachine._currentState._action) {
        this.Broadcast({
          topic: 'player.action',
          action: this._stateMachine._currentState.Name,
          time: this._stateMachine._currentState._action.time,
        });
      }

      const currentState = this._stateMachine._currentState;
      if (currentState.Name != 'walk' &&
          currentState.Name != 'run' &&
          currentState.Name != 'idle'&&
          currentState.Name != 'jump') {
        return;
      }
    
      const velocity = this._velocity;
      const frameDecceleration = new THREE.Vector3(
          velocity.x * this._decceleration.x,
          velocity.y * this._decceleration.y,
          velocity.z * this._decceleration.z          
      );
      
      frameDecceleration.multiplyScalar(timeInSeconds);
      frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
          Math.abs(frameDecceleration.z), Math.abs(velocity.z));
  
      velocity.add(frameDecceleration);
  
      const controlObject = this._target;
      const _Q = new THREE.Quaternion();
      const _A = new THREE.Vector3();
      const _R = controlObject.quaternion.clone();
    
      if(controlObject.position.y> 0){
        velocity.y = velocity.y-9.8;
      }
      if(controlObject.position.y< 0){
        controlObject.position.y=0;
      }

      const acc = this._acceleration.clone();
      if (input._keys.shift) {
        acc.multiplyScalar(3.0);
      }
  
      if (input._keys.forward ) {
        velocity.z += acc.z * timeInSeconds;
      }
      if (input._keys.backward ) {
        velocity.z -= acc.z * timeInSeconds;
      }

    //   if(input._keys.space&& !this._currentlyJumping){
    //     this._currentlyJumping=true;
    //     for (let index = 0; index < 12; index++) {
    //         velocity.y += acc.y *timeInSeconds; 
    //     }
    //     setTimeout(() => { 
    //         this._currentlyJumping=false;
    //     }, 1.5);
    //   }
      
    const currentTime = Date.now() / 1000; // Get current time in seconds
        if (input._keys.l && (currentTime - this._lastBulletTime) >= this._bulletCooldown) {
            const bullet = new Bullet({
                scene: this._params.scene
            });

            bullet._mesh.position.copy(controlObject.position);
            bullet._mesh.position.y = 0.5; // Adjust y position if needed

            this._bullets.push(bullet); // Add bullet to the array
            this._parent.AddComponent(bullet); // Add bullet component to the parent for cleanup

            this._lastBulletTime = currentTime; // Update last bullet time
        }

        // Update each bullet
        for (let i = this._bullets.length - 1; i >= 0; i--) {
            const bullet = this._bullets[i];
            bullet.Update(timeInSeconds); // Call the bullet's update method

            // If the bullet has been marked for removal, remove it from the array
            if (!bullet._mesh.parent) { // Check if the bullet has been removed from the scene
                this._bullets.splice(i, 1);
            }
        }
      
     if (input._keys.left ) {
        velocity.x += acc.x * timeInSeconds; // Move left in x direction
      } else if (input._keys.right) {
        velocity.x -= acc.x * timeInSeconds; // Move right in x direction
      } 

        const targetDirection = new THREE.Vector3(0, 0, 40);
        const playerPosition = controlObject.position.clone();
        const lookAtDirection = targetDirection.clone().sub(playerPosition).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), lookAtDirection);
      
        controlObject.quaternion.copy(quaternion);
  
      const oldPosition = new THREE.Vector3();
      oldPosition.copy(controlObject.position);
  
      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyQuaternion(controlObject.quaternion);
      forward.normalize();
  
      const sideways = new THREE.Vector3(1, 0, 0);
      sideways.applyQuaternion(controlObject.quaternion);
      sideways.normalize();
      
      const upwards = new THREE.Vector3(0, 1, 0);
      upwards.applyQuaternion(controlObject.quaternion);
      upwards.normalize();

      upwards.multiplyScalar(velocity.y * timeInSeconds);
      sideways.multiplyScalar(velocity.x * timeInSeconds);
      forward.multiplyScalar(velocity.z * timeInSeconds);
  
      const pos = controlObject.position.clone();
      pos.add(forward);
      pos.add(sideways);
      pos.add(upwards);

      const collisions = this._FindIntersections(pos);
      if (collisions.length > 0) {
        return;
      }

      controlObject.position.copy(pos);
      this._position.copy(pos);
  
      this._parent.SetPosition(this._position);
      this._parent.SetQuaternion(this._target.quaternion);
    }
  };
  
  return {
      BasicCharacterControllerProxy: BasicCharacterControllerProxy,
      BasicCharacterController: BasicCharacterController,
  };

})();