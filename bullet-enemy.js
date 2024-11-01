import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';

export const entity_bullet_enemy = (() => {

  class EnemyBullet {
    constructor(params) {
      this._Init(params);
      this._shouldRemove = false; 
    }

    _Init(params) {
      //console.log("Enemy Bullet Created");
      this._scene = params.scene;
      this._startPosition = params.startPosition.clone();
      this._targetPosition = params.targetPosition.clone();
      this._speed = params.speed || 30.0;
      this._players = params.players;
      //console.dir( this._players);

      //console.log("Npcs: "+this._npcs);

      // Create a red, glowing sphere
      const geometry = new THREE.SphereGeometry(1.5, 4, 4); // Bigger sphere size
      const material = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000, // Red glow effect
        emissiveIntensity: 0.5,
      });
      this._mesh = new THREE.Mesh(geometry, material);

      // Set bullet position slightly above the ground
      this._mesh.position.copy(this._startPosition);
      this._mesh.position.y += 3.0; // Adjust height

      this._scene.add(this._mesh);

       // Create a bounding sphere for the bullet
       this._boundingSphere = new THREE.Sphere(this._mesh.position, 0.5); // radius 0.5

      
       // Calculate direction vector
      this._direction = new THREE.Vector3();
      this._direction.subVectors(this._targetPosition, this._startPosition).normalize();
    }

    Update(timeElapsed) {
      //console.log(timeElapsed);
      const moveDistance = this._speed * timeElapsed;
      this._mesh.position.addScaledVector(this._direction, moveDistance);

      // Check if the bullet has reached or passed the target position
      if (this._mesh.position.distanceTo(this._targetPosition) < 0.5||this._shouldRemove) {
        this._scene.remove(this._mesh);
        return;
      }

      this._CheckCollision();
    }

    _CheckCollision() {
      //const npcs = this._params.npcs; // List of NPCs passed from scene or manager
      for (let player of this._players) {
        //console.dir(player);
        //console.log(player.GetComponent('HealthComponent').GetHealth());
          if (player._boundingBox.intersectsSphere(this._boundingSphere)) {
              console.log("Bullet hit Player:");  // <-- Log message here

              const healthComponent = player.GetComponent('HealthComponent');
              if (healthComponent) {
                  console.log('healthComponent: '+healthComponent.GetHealth());
                  healthComponent.TakeDamage(1); // Reduce health by 1
                  }

              // Handle collision (e.g., reduce NPC health, destroy bullet)
              //this._params.scene.remove(this._mesh); // Remove the bullet from the scene
              this._shouldRemove = true;
              return;
          }
      }
  }
  }

  return {
    EnemyBullet: EnemyBullet,
  };
})();
