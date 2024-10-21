import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';

export const entity_bullet_enemy = (() => {

  class EnemyBullet {
    constructor(params) {
      this._Init(params);
    }

    _Init(params) {
      console.log("Enemy Bullet Created");
      this._scene = params.scene;
      this._startPosition = params.startPosition.clone();
      this._targetPosition = params.targetPosition.clone();
      this._speed = params.speed || 30.0;

      // Create a red, glowing sphere
      const geometry = new THREE.SphereGeometry(1.5, 32, 32); // Bigger sphere size
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

      // Calculate direction vector
      this._direction = new THREE.Vector3();
      this._direction.subVectors(this._targetPosition, this._startPosition).normalize();
    }

    Update(timeElapsed) {
      const moveDistance = this._speed * timeElapsed;
      this._mesh.position.addScaledVector(this._direction, moveDistance);

      // Check if the bullet has reached or passed the target position
      if (this._mesh.position.distanceTo(this._targetPosition) < 0.5) {
        this._scene.remove(this._mesh);
      }
    }
  }

  return {
    EnemyBullet: EnemyBullet,
  };
})();
