import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';
import {entity} from './entity.js';

export class Bullet extends entity.Component {
    constructor(params) {
        super();
        this._Init(params);
    }

    _Init(params) {
        console.log("Bullet Created");
        this._params = params;
        this._speed = 100; // Speed of the bullet
        this._lifetime = 1.5; // Time in seconds before the bullet disappears
        this._startTime = Date.now();

        // Create a white sphere for the bullet
        const geometry = new THREE.SphereGeometry(0.5, 16, 16); // Adjust size as needed
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this._mesh = new THREE.Mesh(geometry, material);
        this._mesh.position.set(0, 6, 0);
        this._params.scene.add(this._mesh);
    }

    Update(timeInSeconds) {
        const currentTime = Date.now();
        const elapsed = (currentTime - this._startTime) / 1000; // Convert to seconds

        if (elapsed > this._lifetime) {
            this._params.scene.remove(this._mesh); // Remove from the scene
            //this._parent.RemoveComponent(this); // Remove the bullet component
            return;
        }

        // Move the bullet towards (0, 0, 40)
        const direction = new THREE.Vector3(0, 6, 40).sub(this._mesh.position).normalize();
        this._mesh.position.add(direction.multiplyScalar(this._speed * timeInSeconds));
    }
}
