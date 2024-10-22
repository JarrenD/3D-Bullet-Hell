import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';
import {entity} from './entity.js';

export class Bullet extends entity.Component {
    constructor(params) {
        super();
        this._Init(params);
        this._shouldRemove = false; 
    }

    _Init(params) {
        //console.log("Bullet Created");
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

         // Create a bounding sphere for the bullet
         this._boundingSphere = new THREE.Sphere(this._mesh.position, 0.5); // radius 0.5
    }

    Update(timeInSeconds) {
        const currentTime = Date.now();
        const elapsed = (currentTime - this._startTime) / 1000; // Convert to seconds

        if (elapsed > this._lifetime || this._shouldRemove) { // Check for removal
            this._params.scene.remove(this._mesh); // Remove from the scene
            return; // Exit the update
        }

        // Move the bullet towards (0, 0, 40)
        const direction = new THREE.Vector3(0, 6, 40).sub(this._mesh.position).normalize();
        this._mesh.position.add(direction.multiplyScalar(this._speed * timeInSeconds));

         // Check for collisions with NPCs
         this._CheckCollision();
    }

    _CheckCollision() {
        const npcs = this._params.npcs; // List of NPCs passed from scene or manager
        for (let npc of npcs) {
            //console.dir(npc);
            if (npc._boundingBox.intersectsSphere(this._boundingSphere)) {
                console.log("Bullet hit NPC:");  // <-- Log message here

                const healthComponent = npc.GetComponent('HealthComponent');
                if (healthComponent) {
                    //console.log('healthComponent: '+healthComponent.GetHealth());
                    healthComponent.TakeDamage(1); // Reduce health by 1
                    }

                // Handle collision (e.g., reduce NPC health, destroy bullet)
                this._params.scene.remove(this._mesh); // Remove the bullet from the scene
                this._shouldRemove = true;
                return;
            }
        }
    }
}
