import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/FBXLoader.js';

import {finite_state_machine} from './finite-state-machine.js';
import {entity} from './entity.js';
import {player_entity} from './player-entity.js'
import {player_state} from './player-state.js'
import {entity_bullet_enemy} from './bullet-enemy.js';
import {entity_wall_enemy} from './enemy-wall.js';
import {entity_wall_enemy_rot} from './enemy-wall-rotating.js';

import { entity_manager } from './entity-manager.js';
;


export const npc_entity = (() => {
  
  class AIInput {
    constructor() {
      this._Init();    
    }

    _Init() {
      this._keys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        space: false,
        shift: false,
      };
    }
  };

  class NPCFSM extends finite_state_machine.FiniteStateMachine {
    constructor(proxy) {
      super();
      this._proxy = proxy;
      this._Init();
    }

    _Init() {
      this._AddState('idle', player_state.IdleState);
      this._AddState('walk', player_state.WalkState);
      this._AddState('death', player_state.DeathState);
      //this._AddState('attack', player_state.AttackState);
    }
  };

  class NPCController extends entity.Component {
    constructor(params) {
      super();
      this._Init(params);
    }

    _Init(params) {
      //console.log('Entity Created');
      this._params = params;
      this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
      this._acceleration = new THREE.Vector3(1, 0.25, 40.0);
      this._velocity = new THREE.Vector3(0, 0, 0);
      this._position = new THREE.Vector3();

      this._bulletCooldown = 0.0; // Cooldown timer for shooting bullets
      this._bulletInterval = 5; // 1 second interval between bullets

      this._bullets = [];
      this._enemyWalls = [];

      this._healthThreshold= 350/2;
      this._canSpawnWall=true;

      this._boundingBox = new THREE.Box3();

      this._animations = {};
      this._input = new AIInput();
      // FIXME
      this._stateMachine = new NPCFSM(
          new player_entity.BasicCharacterControllerProxy(this._animations));

      this._LoadModels();
    }

    InitComponent() {
      this._RegisterHandler('health.death', (m) => { this._OnDeath(m); });
      this._RegisterHandler('update.position', (m) => { this._OnPosition(m); });
    }

    _OnDeath(msg) {
      this._stateMachine.SetState('death');
      const elapsedTime = document.getElementById('timer').textContent;
      localStorage.setItem('elapsedTime', elapsedTime);
  
      // Delay of 10 seconds before changing the page
      setTimeout(() => {
          window.location.href = 'boss_defeated2.html'; // Redirect to the new page
      }, 3000); // 10 seconds in milliseconds
  }

    _OnPosition(m) {
      if (this._target) {
        this._target.position.copy(m.value);
        this._target.position.y = 0.35;
      }
    }

    _LoadModels() {
      console.log("loading model");
      const loader = new FBXLoader();
      loader.setPath('./resources/MechBosses/Textured/FBX/');
      loader.load(this._params.resourceName, (glb) => {
        this._target = glb;
        this._params.scene.add(this._target);

        this._target.scale.setScalar(0.025);
        this._target.position.copy(this._parent._position);
        this._target.position.y += 0.35;
        const texLoader = new THREE.TextureLoader();
        const texture = texLoader.load(
            './resources/MechBosses/Textured/Textures/' + this._params.resourceTexture);
        texture.encoding = THREE.sRGBEncoding;
        texture.flipY = true;

        this._target.traverse(c => {
          c.castShadow = true;
          c.receiveShadow = true;
          if (c.material) {
            c.material.map = texture;
            c.material.side = THREE.DoubleSide;
          }
        });

         // Update bounding box after model is loaded
         this._boundingBox.setFromObject(this._target);


        this._mixer = new THREE.AnimationMixer(this._target);

        const fbx = glb;
        const _FindAnim = (animName) => {
          for (let i = 0; i < fbx.animations.length; i++) {
            if (fbx.animations[i].name.includes(animName)) {
              const clip = fbx.animations[i];
              const action = this._mixer.clipAction(clip);
              return {
                clip: clip,
                action: action
              }
            }
          }
          return null;
        };
        //console.log("Animations Start");
        this._animations['idle'] = _FindAnim('Idle');
        this._animations['walk'] = _FindAnim('Walk');
        this._animations['death'] = _FindAnim('Death');
        //this._animations['attack'] = _FindAnim('Bite_Front');

        this._stateMachine.SetState('idle');
        //console.log("Animations End");
      });
      //this._SpawnEnemyWalls(5);
    }

    _ShootEnemyBullet(x,y,z,heightOffestStart) {
      const enemyPosition = new THREE.Vector3(0, heightOffestStart, 40);

      //const targetPosition = new THREE.Vector3(0, 6, 80);
      const targetPosition = new THREE.Vector3(x, y, z);

      const enemyBullet = new entity_bullet_enemy.EnemyBullet({
        scene: this._params.scene,
        startPosition: enemyPosition,
        targetPosition: targetPosition,
        speed: 30.0,
        players:this._params.playerList,
      });
      this._bullets.push(enemyBullet);
      
    }



    _ShootEnemySpiralBullets(bulletCount, spiralRadius, revolutions) {
      //console.log("begining spiral fire");
      const center = new THREE.Vector3(0, 0, 40);
      const heightOffset=1;

      const angleIncrement = (2 * Math.PI * revolutions) / bulletCount; // Spread bullets evenly over revolutions
      let currentAngle = 0;
      const bulletDelay = 0.2; // Delay between shots
    
      for (let i = 0; i < bulletCount; i++) {
        // Set a timeout for each bullet to create the delay effect
        setTimeout(() => {
          // Calculate the target position in the spiral
          const x = center.x + spiralRadius * Math.cos(currentAngle);
          const z = center.z + spiralRadius * Math.sin(currentAngle);
    
          // Optionally change height (y) for a vertical spiral effect
          const y = center.y + heightOffset * (i / bulletCount);
    
          this._ShootEnemyBullet(x, y, z,3);
    
          // Increment angle for the next bullet
          currentAngle += angleIncrement;
        }, i * bulletDelay * 1000); // Delay each bullet by i * 0.2 seconds (converted to ms)
      }
    }
    
    _ShootEnemyJumpRingBullets(bulletCount, radius, heightOffset) {
      bulletCount= bulletCount*2;
      const center = new THREE.Vector3(0, heightOffset, 40); // Low height for jump-over effect
      const angleIncrement = (2 * Math.PI) / bulletCount; // Evenly spaced bullets in a circle
      let currentAngle = 0;
    
      for (let i = 0; i < bulletCount; i++) {
        // Calculate the target position in a circular pattern
        const x = center.x + radius * Math.cos(currentAngle);
        const z = center.z + radius * Math.sin(currentAngle);
        
        this._ShootEnemyBullet(x, center.y, z,0); // Shoot bullet in the calculated position
        
        // Increment angle for the next bullet
        currentAngle += angleIncrement;
      }
    }

    _ShootEnemyRotatingGapBullets(bulletCount, radius, gapCount, rotations) {
      const center = new THREE.Vector3(0, 0, 40);
      const fullCircle = 2 * Math.PI;
      const angleIncrement = fullCircle / bulletCount; 
      const rotationIncrement = (Math.PI / 6); // 30 degrees in radians
      const gapSize = fullCircle / gapCount; // Determines size of the gaps in radians
      let offset = 0;

      for (let r = 0; r < rotations; r++) {
        setTimeout(() => {
          let currentAngle = r * rotationIncrement+offset; // Rotate by 30 degrees each time
          for (let i = 0; i < bulletCount; i++) {
              const x = center.x + radius * Math.cos(currentAngle);
              const z = center.z + radius * Math.sin(currentAngle);
              const y = center.y; // Low on the ground
              this._ShootEnemyBullet(x, y, z,3);
              currentAngle += angleIncrement;
          }
        }, r * 500); // Delay each rotation by 0.5 seconds
        offset=offset+45;
        //console.log("OFFSET : "+ offset);
      }
    }
    _SpawnEnemyWalls(delay = 10) { // Default delay is set to 10 seconds
      const wallAttackParams = {
        scene: this._params.scene,
        position: new THREE.Vector3(0, 0, 40), // Spawn position for walls
        radius: 60, // Distance from center for wall positions
        height: 60, // Wall height
        width: 2, // Wall width
        players: this._params.playerList, // Pass players list if needed
        wallCount: 8, // Number of walls to spawn
      };
    
      // Use setTimeout to wait for the specified delay before spawning walls
      setTimeout(() => {
        // Call the SpawnWalls function with the parameters
        this._enemyWalls = entity_wall_enemy.SpawnWalls(wallAttackParams);
      }, delay * 1000); // Convert seconds to milliseconds
    }

    get Position() {
      return this._position;
    }

    get Rotation() {
      if (!this._target) {
        return new THREE.Quaternion();
      }
      return this._target.quaternion;
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
      const nearby = grid.FindNearbyEntities(2).filter(e => _IsAlive(e));
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

    _FindPlayer() {
      const _IsAlivePlayer = (c) => {
        const h = c.entity.GetComponent('HealthComponent');
        if (!h) {
          return false;
        }
        if (c.entity.Name != 'player') {
          return false;
        }
        return h._health > 0;
      };

      const grid = this.GetComponent('SpatialGridController');
      const nearby = grid.FindNearbyEntities(10000);
      if (nearby.length == 0) {
        return new THREE.Vector3(0, 0, 0);
      }

      const dir = this._parent._position.clone();
      dir.sub(nearby[0].entity._position);
      dir.y = 0.0;
      dir.normalize();

      return dir;
    }

    _UpdateAI(timeInSeconds) {
      //console.table("npcs: "+this._params.npcList[0]);
      const currentState = this._stateMachine._currentState;
      if (currentState.Name != 'walk' &&
          currentState.Name != 'run' &&
          currentState.Name != 'idle') {
        return;
      }

      if (currentState.Name == 'death') {
        return;
      }

// Update bullet cooldown and shoot if time is up
this._bulletCooldown += timeInSeconds;
if (this._bulletCooldown >= this._bulletInterval) {
  if(this._canSpawnWall && this._parent.GetComponent('HealthComponent').GetHealth()<this._healthThreshold){
    this._SpawnEnemyWalls(10);
    this._canSpawnWall=false;
  }
  const attack = Math.random();
  if (attack < 0.33) {
    this._ShootEnemySpiralBullets(80, 80, 3);
  } else if (attack < 0.66) {
    this._ShootEnemyJumpRingBullets(60, 80, 0);
  } else {
    this._ShootEnemyRotatingGapBullets(40, 80, 24, 4); // Shoots with gaps, 30-degree rotation, 4 times
  }
  this._bulletCooldown = 0.0; // Reset cooldown
}

if (this._enemyWalls && Array.isArray(this._enemyWalls)) {
  this._enemyWalls.forEach(wall => wall.Update(timeInSeconds));
}

      for (let i = this._bullets.length - 1; i >= 0; i--) {
        const bullet = this._bullets[i];
        bullet.Update(timeInSeconds); // Call the bullet's update method

        // If the bullet has been marked for removal, remove it from the array
        if (!bullet._mesh.parent) { // Check if the bullet has been removed from the scene
            this._bullets.splice(i, 1);
        }
    }

          // Get the direction to the player
          const dirToPlayer = this._FindPlayer();

          const controlObject = this._target;

          // If there's no direction to the player, exit early
          if (dirToPlayer.length() === 0) {
              return;
          }

          // Set the robot's rotation to face the player
          const m = new THREE.Matrix4();
          m.lookAt(
              new THREE.Vector3(0, 0, 0), // Origin (or a reference point)
              dirToPlayer, // Direction towards the player
              new THREE.Vector3(0, 1, 0) // Up vector
          );

          const _R = controlObject.quaternion.clone();
          _R.setFromRotationMatrix(m);
          controlObject.quaternion.copy(_R);

          // Update the parent position and quaternion (optional)
          this._parent.SetQuaternion(controlObject.quaternion);

          
    }

  

    _OnAIWalk(timeInSeconds) {
      const dirToPlayer = this._FindPlayer();

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
  
      this._input._keys.forward = false;

      const acc = this._acceleration;
      if (dirToPlayer.length() == 0) {
        return;
      }

      this._input._keys.forward = true;
      velocity.z += acc.z * timeInSeconds;

      const m = new THREE.Matrix4();
      m.lookAt(
          new THREE.Vector3(0, 0, 0),
          dirToPlayer,
          new THREE.Vector3(0, 1, 0));
      _R.setFromRotationMatrix(m);
  
      controlObject.quaternion.copy(_R);
  
      const oldPosition = new THREE.Vector3();
      oldPosition.copy(controlObject.position);
  
      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyQuaternion(controlObject.quaternion);
      forward.normalize();
  
      const sideways = new THREE.Vector3(1, 0, 0);
      sideways.applyQuaternion(controlObject.quaternion);
      sideways.normalize();
  
      sideways.multiplyScalar(velocity.x * timeInSeconds);
      forward.multiplyScalar(velocity.z * timeInSeconds);
  
      const pos = controlObject.position.clone();
      pos.add(forward);
      pos.add(sideways);

      const collisions = this._FindIntersections(pos);
      if (collisions.length > 0) {
        this._input._keys.space = true;
        this._input._keys.forward = false;
        return;
      }

      controlObject.position.copy(pos);
      this._position.copy(pos);
  
      this._parent.SetPosition(this._position);
      this._parent.SetQuaternion(this._target.quaternion);
    }

    Update(timeInSeconds) {
      //console.log("Health: "+this._parent.GetComponent('HealthComponent').GetHealth());
      //console.table(this._parent);

      if (!this._stateMachine._currentState) {
        return;
      }

      if (this._target) {
        this._boundingBox.setFromObject(this._target);
    }


      this._input._keys.space = false;
      this._input._keys.forward = false;

      this._UpdateAI(timeInSeconds);

      this._stateMachine.Update(timeInSeconds, this._input);

      // HARDCODED
      if (this._stateMachine._currentState._action) {
        this.Broadcast({
          topic: 'player.action',
          action: this._stateMachine._currentState.Name,
          time: this._stateMachine._currentState._action.time,
        });
      }
      
      if (this._mixer) {
        this._mixer.update(timeInSeconds);
      }
    }
  };

  return {
    NPCController: NPCController,
  };

})();