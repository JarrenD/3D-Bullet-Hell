import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';

export const entity_wall_enemy = (() => {
  class EnemyWall {
    constructor(params) {
      this._Init(params);
    }

    _Init(params) {
      this._scene = params.scene;
      this._position = params.position || new THREE.Vector3(0, 0, 40);
      this._radius = params.radius || 60; // Distance from center
      this._height = params.height || 20; // Wall height
      this._width = params.width || 2; // Wall thickness
      this._players = params.players;

      this._shouldRemove = false;
      this._hitboxActive = false; // Hitbox state
      this._transitionDuration = 1.5; // Duration to transition to active state
      this._elapsedTime = 0; // Timer for hitbox activation

      // Define wall geometry
      const geometry = new THREE.BoxGeometry(this._width, this._height, 100); // Tall, thin wall
      const material = new THREE.MeshStandardMaterial({
        color: 0x00ff00, // Light green
        emissive: 0x00ff00,
        emissiveIntensity: 0.5,
      });
      this._mesh = new THREE.Mesh(geometry, material);

      // Position the wall based on its angle
      this._mesh.position.copy(this._position);
      this._scene.add(this._mesh);

      // Create bounding box for collision detection
      this._boundingBox = new THREE.Box3().setFromObject(this._mesh);
      //this._UpdateBoundingBox();
      // Create a visual representation of the bounding box
      const boxHelper = new THREE.Box3Helper(this._boundingBox, new THREE.Color(0x0000ff)); // Blue color for the bounding box
      this._scene.add(boxHelper);
    }
    _UpdateBoundingBox() {
        // Calculate the bounding box based on the mesh's current position and geometry size
        const halfExtents = new THREE.Vector3(this._width / 2, this._height / 2, 50); // Half the dimensions for Box3
        this._boundingBox.setFromCenterAndSize(this._mesh.position, halfExtents);
      }

    Update(deltaTime) {
      this._elapsedTime += deltaTime; // Increment timer
      
      if (!this._hitboxActive && this._elapsedTime >= this._transitionDuration) {
        this._hitboxActive = true;
        console.log("Hitbox activated, changing color to red"); // Debug log

        // Change color to red when hitbox becomes active
        this._mesh.material.color.set(0x990000); // Change to red
        this._mesh.material.emissive.set(0xff0000); // Change emissive color to red
      }

      // Update bounding box position based on wall mesh position
      this._boundingBox.setFromObject(this._mesh); // Update bounding box to match wall mesh
      //this._UpdateBoundingBox();
      this._CheckCollision();
    }

    _CheckCollision() {
      if (!this._hitboxActive) return; // Skip collision check if hitbox is inactive
      
      for (let player of this._players) {
        if (player._boundingBox.intersectsBox(this._boundingBox)) {
          console.log("Player hit by wall");
          const healthComponent = player.GetComponent('HealthComponent');
          if (healthComponent) {
            healthComponent.TakeDamage(1);
          }
        }
      }
    }
  }

  function SpawnWalls(params) {
    const wallCount = params.wallCount || 8; // Number of walls
    const angleIncrement = (2 * Math.PI) / wallCount; // Evenly spaced in a circle
    const walls = [];

    for (let i = 0; i < wallCount; i++) {
      const angle = i * angleIncrement;
      const x = params.position.x + params.radius * Math.cos(angle);
      const z = params.position.z + params.radius * Math.sin(angle);
      const wallParams = {
        ...params,
        position: new THREE.Vector3(x, params.position.y, z),
      };
      const wall = new EnemyWall(wallParams);
      walls.push(wall);

      // Rotate the wall to face the center
      wall._mesh.lookAt(params.position);
    }
    return walls;
  }

  return {
    EnemyWall: EnemyWall,
    SpawnWalls: SpawnWalls,
  };
})();
