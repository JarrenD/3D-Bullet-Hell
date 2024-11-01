import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';

export const entity_wall_enemy = (() => {
  class EnemyWall {
    constructor(params) {
      this._Init(params);
    }

    _Init(params) {
      this._scene = params.scene;
      this._position = params.position || new THREE.Vector3(0, 0, 40);
      this._radius = params.radius || 60;
      this._height = params.height || 20;
      this._width = params.width || 2;
      this._players = params.players;
      this._spinning = params.spinning || false;  // New parameter to control spinning

      this._shouldRemove = false;
      this._hitboxActive = false;
      this._transitionDuration = 1.5;
      this._elapsedTime = 0;

      const geometry = new THREE.BoxGeometry(this._width, this._height, 100);
      const material = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5,
      });
      this._mesh = new THREE.Mesh(geometry, material);

      this._mesh.position.copy(this._position);
      this._scene.add(this._mesh);

      this._segmentBoundingBoxes = [];
      this._CreateSegmentBoundingBoxes();
    }

    _CreateSegmentBoundingBoxes() {
      const segmentLength = 2;
      const wallLength = 100;
      const numSegments = Math.ceil(wallLength / segmentLength);
      const rotationQuaternion = new THREE.Quaternion().setFromRotationMatrix(this._mesh.matrixWorld);

      for (let i = 0; i < numSegments; i++) {
        const localPosition = new THREE.Vector3(0, 0, -wallLength / 2 + i * segmentLength + segmentLength / 2);
        const worldPosition = localPosition.applyQuaternion(rotationQuaternion).add(this._mesh.position);

        const segmentBoundingBox = new THREE.Box3().setFromCenterAndSize(
          worldPosition,
          new THREE.Vector3(this._width, this._height, segmentLength)
        );

        this._segmentBoundingBoxes.push(segmentBoundingBox);
      }
    }

    Update(deltaTime) {
      this._elapsedTime += deltaTime;

      if (!this._hitboxActive && this._elapsedTime >= this._transitionDuration) {
        this._hitboxActive = true;
        this._mesh.material.color.set(0x990000);
        this._mesh.material.emissive.set(0xff0000);
      }

      // Spin the wall if the spinning flag is set to true
      if (this._spinning) {
        const spinSpeed = 0.2;  // Adjust this for faster or slower rotation (lower value = slower)
        const centerX = 0;
        const centerZ = 40;

        // Calculate the angle to rotate this frame
        const angle = spinSpeed * deltaTime;

        // Rotate around the point (0, 40)
        const offsetX = this._mesh.position.x - centerX;
        const offsetZ = this._mesh.position.z - centerZ;
        const rotatedX = offsetX * Math.cos(angle) - offsetZ * Math.sin(angle);
        const rotatedZ = offsetX * Math.sin(angle) + offsetZ * Math.cos(angle);

        // Update the mesh position to the new rotated position
        this._mesh.position.set(centerX + rotatedX, this._mesh.position.y, centerZ + rotatedZ);
        this._mesh.lookAt(centerX, this._mesh.position.y, centerZ);  // Keeps the wall facing the center
      }

      this._UpdateSegmentBoundingBoxes();
      this._CheckCollision();
    }

    _UpdateSegmentBoundingBoxes() {
      const wallLength = 100;
      const segmentLength = 2;
      const rotationQuaternion = new THREE.Quaternion().setFromRotationMatrix(this._mesh.matrixWorld);

      for (let i = 0; i < this._segmentBoundingBoxes.length; i++) {
        const localPosition = new THREE.Vector3(0, 0, -wallLength / 2 + i * segmentLength + segmentLength / 2);
        const worldPosition = localPosition.applyQuaternion(rotationQuaternion).add(this._mesh.position);

        this._segmentBoundingBoxes[i].setFromCenterAndSize(
          worldPosition,
          new THREE.Vector3(this._width, this._height, segmentLength)
        );
      }
    }

    _CheckCollision() {
      if (!this._hitboxActive) return;

      for (let player of this._players) {
        for (let boundingBox of this._segmentBoundingBoxes) {
          if (player._boundingBox.intersectsBox(boundingBox)) {
            console.log("Player hit by wall segment");
            const healthComponent = player.GetComponent('HealthComponent');
            if (healthComponent) {
              healthComponent.TakeDamage(1);
            }
            return;
          }
        }
      }
    }
  }

  function SpawnWalls(params) {
    const wallCount = params.wallCount || 8;
    const angleIncrement = (2 * Math.PI) / wallCount;
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

      wall._mesh.lookAt(params.position);
    }
    return walls;
  }

  function SpawnSpinningWalls(params) {
    const wallCount = params.wallCount || 8;
    const angleIncrement = (2 * Math.PI) / wallCount;
    const walls = [];

    for (let i = 0; i < wallCount; i++) {
      const angle = i * angleIncrement;
      const x = params.position.x + params.radius * Math.cos(angle);
      const z = params.position.z + params.radius * Math.sin(angle);
      const wallParams = {
        ...params,
        position: new THREE.Vector3(x, params.position.y, z),
        spinning: true,  // Enable spinning for each wall
      };
      const wall = new EnemyWall(wallParams);
      walls.push(wall);

      wall._mesh.lookAt(params.position);
    }
    return walls;
  }

  return {
    EnemyWall: EnemyWall,
    SpawnWalls: SpawnWalls,
    SpawnSpinningWalls: SpawnSpinningWalls,
  };
})();
