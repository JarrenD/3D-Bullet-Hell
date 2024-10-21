import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';

import { third_person_camera } from './third-person-camera.js';
import { entity_manager } from './entity-manager.js';
import { player_entity } from './player-entity.js'
import { entity } from './entity.js';
import { player_input } from './player-input.js';
import { spatial_hash_grid } from './spatial-hash-grid.js';
import { spatial_grid_controller } from './spatial-grid-controller.js';
import { math } from './math.js';

const _VS = `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
  vWorldPosition = worldPosition.xyz;

  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;


const _FS = `
uniform vec3 topColor;
uniform vec3 bottomColor;
uniform float offset;
uniform float exponent;

varying vec3 vWorldPosition;

void main() {
  float h = normalize( vWorldPosition + offset ).y;
  gl_FragColor = vec4( mix( bottomColor, topColor, max( pow( max( h , 0.0), exponent ), 0.0 ) ), 1.0 );
}`;


class BulletHell {
    constructor() {
        this._Initialize();
    }

    _Initialize() {
        this._threejs = new THREE.WebGLRenderer({
            antialias: true,
        });
        this._threejs.outputEncoding = THREE.sRGBEncoding;
        this._threejs.gammaFactor = 2.2;
        this._threejs.shadowMap.enabled = true;
        this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
        this._threejs.setPixelRatio(window.devicePixelRatio);
        this._threejs.setSize(window.innerWidth, window.innerHeight);
        this._threejs.domElement.id = 'threejs';

        document.getElementById('container').appendChild(this._threejs.domElement);

        window.addEventListener('resize', () => {
            this._OnWindowResize();
        }, false);

        const fov = 60;
        const aspect = 1920 / 1080;
        const near = 1.0;
        const far = 10000.0;
        this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this._camera.position.set(25, 10, 25);


        // const controls = new OrbitControls(
        //     this._camera, this._threejs.domElement);
        // controls.target.set(0, 20, 0);
        // controls.update();

        this._scene = new THREE.Scene();
        this._scene.background = new THREE.Color(0xFFFFFF);
        this._scene.fog = new THREE.FogExp2(0x89b2eb, 0.002);

        let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
        light.position.set(-10, 500, 10);
        light.target.position.set(0, 0, 0);
        light.castShadow = true;
        light.shadow.bias = -0.001;
        light.shadow.mapSize.width = 4096;
        light.shadow.mapSize.height = 4096;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 1000.0;
        light.shadow.camera.left = 100;
        light.shadow.camera.right = -100;
        light.shadow.camera.top = 100;
        light.shadow.camera.bottom = -100;
        this._scene.add(light);

        this._sun = light;

        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(5000, 5000, 10, 10),
            new THREE.MeshStandardMaterial({
                color: 0x1e601c,
            }));
        plane.castShadow = false;
        plane.receiveShadow = true;
        plane.rotation.x = -Math.PI / 2;
        this._scene.add(plane);

        this._entityManager = new entity_manager.EntityManager();
        this._grid = new spatial_hash_grid.SpatialHashGrid(
            [[-1000, -1000], [1000, 1000]], [100, 100]);

        //this._LoadControllers();
        this._LoadPlayer();
        // this._LoadFoliage();
        // this._LoadClouds();
        this._LoadSky();

        this._previousRAF = null;
        this._RAF();

        const cylinderGeometry = new THREE.CylinderGeometry(
            1, 1, 2, 32, 1, false, 0, Math.PI * 2
        );

        const cylinderMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF0000, // Red color
        });

        const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

        cylinder.position.set(0, 1, 40); // Set the position
        cylinder.castShadow = true; // Enable shadow casting
        cylinder.receiveShadow = true; // Enable shadow receiving
        cylinder.scale.set(4, 12, 4);
        this._scene.add(cylinder); // Add to the scene

        // Create a function to generate a tall cylinder
        function createTallCylinder(position) {
            const tallCylinderGeometry = new THREE.CylinderGeometry(
                0.6,  // Radius at the bottom
                0.6,  // Radius at the top
                100,   // Height
                32,   // Number of radial segments
                1,    // Number of height segments
                false, // Open ended
                0,    // Phi start
                Math.PI * 2 // Phi length
            );

            const tallCylinderMaterial = new THREE.MeshStandardMaterial({
                color: 0x000000, // Black color
            });

            const tallCylinder = new THREE.Mesh(tallCylinderGeometry, tallCylinderMaterial);
            tallCylinder.position.copy(position); // Set the position from the argument
            tallCylinder.castShadow = true; // Enable shadow casting
            tallCylinder.receiveShadow = true; // Enable shadow receiving

            return tallCylinder; // Return the new mesh instance
        }

        // Example of adding multiple cylinders
        const positions = [
            new THREE.Vector3(0, 1, -40),
            new THREE.Vector3(0, 1, 120),
            new THREE.Vector3(-80, 1, 40),
            new THREE.Vector3(80, 1, 40),
            new THREE.Vector3(80, 1, -40),
            new THREE.Vector3(80, 1, 120),
            new THREE.Vector3(-80, 1, -40),
            new THREE.Vector3(-80, 1, 120)
        ];

        positions.forEach(pos => {
            const cylinder = createTallCylinder(pos); // Create a new cylinder
            this._scene.add(cylinder); // Add to the scene
        });


    }

    _LoadSky() {
        const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xFFFFFFF, 0.6);
        hemiLight.color.setHSL(0.6, 1, 0.6);
        hemiLight.groundColor.setHSL(0.095, 1, 0.75);
        this._scene.add(hemiLight);
    
        const uniforms = {
          "topColor": { value: new THREE.Color(0x0077ff) },
          "bottomColor": { value: new THREE.Color(0xffffff) },
          "offset": { value: 33 },
          "exponent": { value: 0.6 }
        };
        uniforms["topColor"].value.copy(hemiLight.color);
    
        this._scene.fog.color.copy(uniforms["bottomColor"].value);
    
        const skyGeo = new THREE.SphereBufferGeometry(1000, 32, 15);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: _VS,
            fragmentShader: _FS,
            side: THREE.BackSide
        });
    
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this._scene.add(sky);
      }

    _LoadPlayer() {
        const params = {
            camera: this._camera,
            scene: this._scene,
        };

        const player = new entity.Entity();
        //player.SetPosition(new THREE.Vector3(10, 10, 10));
        player.AddComponent(new player_input.BasicCharacterControllerInput(params));
        player.AddComponent(new player_entity.BasicCharacterController(params));
        player.AddComponent(
            new spatial_grid_controller.SpatialGridController({ grid: this._grid }));
        this._entityManager.Add(player, 'player');


        const camera = new entity.Entity();
        camera.AddComponent(
            new third_person_camera.ThirdPersonCamera({
                camera: this._camera,
                target: this._entityManager.Get('player')
            }));
        this._entityManager.Add(camera, 'player-camera');



    }

    _OnWindowResize() {
        this._camera.aspect = window.innerWidth / window.innerHeight;
        this._camera.updateProjectionMatrix();
        this._threejs.setSize(window.innerWidth, window.innerHeight);
    }

    _UpdateSun() {
        const player = this._entityManager.Get('player');
        const pos = player._position;

        this._sun.position.copy(pos);
        this._sun.position.add(new THREE.Vector3(-10, 500, -10));
        this._sun.target.position.copy(pos);
        this._sun.updateMatrixWorld();
        this._sun.target.updateMatrixWorld();
    }

    _RAF() {
        requestAnimationFrame((t) => {
            if (this._previousRAF === null) {
                this._previousRAF = t;
            }

            this._RAF();

            this._threejs.render(this._scene, this._camera);
            this._Step(t - this._previousRAF);
            this._previousRAF = t;
        });
    }

    _Step(timeElapsed) {
        const timeElapsedS = Math.min(1.0 / 30.0, timeElapsed * 0.001);

        this._UpdateSun();

        this._entityManager.Update(timeElapsedS);
    }
}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
    _APP = new BulletHell();
});