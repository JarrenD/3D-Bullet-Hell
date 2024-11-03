import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118.1/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';

import { third_person_camera } from './third-person-camera.js';
import { entity_manager } from './entity-manager.js';
import { player_entity } from './player-entity.js'
import { entity } from './entity.js';
import { player_input } from './player-input.js';
import { spatial_hash_grid } from './spatial-hash-grid.js';
import { spatial_grid_controller } from './spatial-grid-controller.js';
import {gltf_component} from './gltf-component.js';
import {npc_entity} from './npc-entity.js';
import { math } from './math.js';
import {attack_controller} from './attacker-controller.js';
import {health_component} from './health-component.js';
import {health_bar} from './health-bar.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/loaders/GLTFLoader.js';
import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/FBXLoader.js';


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


        this._topViewCamera= new THREE.OrthographicCamera(
            -125, // left
            125,  // right
            125,                // top
            -125,               // bottom
            0.1,                        // near clipping plane
            1000                        // far clipping plane
        );
        this._topViewCamera.position.set(0, 100, 40);  // Set a high y position for a top view
        this._topViewCamera.lookAt(0, 0, 40);



        this._npcList = [];
        this._playerList=[];

        // const controls = new OrbitControls(
        //     this._camera, this._threejs.domElement);
        // controls.target.set(0, 20, 0);
        // controls.update();

        this._scene = new THREE.Scene();
        this._scene.background = new THREE.Color(0xFFFFFF);
        this._scene.fog = new THREE.FogExp2(0x89b2eb, 0.002);

        let light = new THREE.DirectionalLight(0xF4FDFF, 1.0);
        light.position.set(20, 50, -40);
        light.target.position.set(0, 0, 40);
        light.castShadow = true;
        light.shadow.bias = -0.001;
        light.shadow.mapSize.width = 4096;
        light.shadow.mapSize.height = 4096;
        light.shadow.camera.near = 0.1;
        light.shadow.camera.far = 1000.0;
        light.shadow.camera.left = 260;
        light.shadow.camera.right = -260;
        light.shadow.camera.top = 260;
        light.shadow.camera.bottom = -260;
        this._scene.add(light);

        this._sun = light;


        this._entityManager = new entity_manager.EntityManager();
        this._grid = new spatial_hash_grid.SpatialHashGrid(
            [[-1000, -1000], [1000, 1000]], [100, 100]);

        //this._LoadControllers();
        this._LoadPlayer();
        // this._LoadFoliage();
        // this._LoadClouds();
        this._LoadSky();
        this._LoadArena();
       // this._LoadBoss();
        this._previousRAF = null;
        this._RAF();



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
    
      _LoadArena() {
        //Loading screen functionality
        const loadingManager = new THREE.LoadingManager();
        const progressBar = document.getElementById('progress-bar');
        const progressBarContainer = document.querySelector('.progress-bar-container');
        loadingManager.onProgress = function(url,loaded,total){
            progressBar.value = (loaded/total)*100;
        };

        loadingManager.onLoad = function(){
            progressBarContainer.style.display = 'none';
        };

        //Loading arena
        const loader = new GLTFLoader(loadingManager);
        const modelPath = './resources/arena.glb'; // Replace with the path to your .glb model file
    
        loader.load(modelPath, (gltf) => {
            const platform = gltf.scene; // Get the loaded model
            platform.position.set(0, -7.5, 40);
            platform.scale.set(0.01, 0.01, 0.01);
        
            // Enable shadow properties
            platform.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;   // If you want the model to cast shadows on itself or other objects
                    node.receiveShadow = true; // Ensure the model receives shadows
                }
            });
        
            this._scene.add(platform);
        }, undefined, (error) => {
            console.error('An error occurred while loading the model:', error);
        });
    }

    //   _LoadBoss(){
        
    //   }

    

    _LoadPlayer() {

        const boss = new entity.Entity();
        
        const pos = new THREE.Vector3(
            0,
            0,
            40);
            boss.SetPosition(pos);
        boss.AddComponent(new npc_entity.NPCController({
            camera: this._camera,
            scene: this._scene,
            resourceName: 'Leela.fbx',
            resourceTexture: 'Leela_Texture.png',
            playerList: this._playerList,
        }));
        boss.AddComponent(
            new health_component.HealthComponent({
                health: 250,
                maxHealth: 250,
                strength: 2,
                wisdomness: 2,
                benchpress: 3,
                curl: 1,
                experience: 0,
                level: 1,
                camera: this._camera,
                scene: this._scene,
            })
        );
        boss.AddComponent(
            new spatial_grid_controller.SpatialGridController({grid: this._grid}));
            boss.AddComponent(new health_bar.HealthBar({
                parent: this._scene,
                camera: this._camera,
            })); 
        boss.AddComponent(new attack_controller.AttackController({timing: 0.35}));
        
        this._entityManager.Add(boss);
        this._npcList.push(boss.GetComponent('NPCController'));

        const params = {
            camera: this._camera,
            scene: this._scene,
            npcList: this._npcList,
        };

        const player = new entity.Entity();
        //player.SetPosition(new THREE.Vector3(10, 10, 10));
        player.AddComponent(new player_input.BasicCharacterControllerInput(params));
        player.AddComponent(new player_entity.BasicCharacterController(params));
        player.AddComponent(
            new spatial_grid_controller.SpatialGridController({ grid: this._grid }));
        this._entityManager.Add(player, 'player');
        player.AddComponent(new health_component.HealthComponent({
            updateUI: true,
            health: 5,
            maxHealth: 5,
            strength: 50,
            wisdomness: 5,
            benchpress: 20,
            curl: 100,
            experience: 0,
            level: 1,
        }));

        this._playerList.push(player.GetComponent('BasicCharacterController'));

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

            this._threejs.clear();

            // Render the main camera view
            this._threejs.setViewport(0, 0, window.innerWidth, window.innerHeight);
            this._threejs.render(this._scene, this._camera);

            // Render the top-view camera in the bottom-left corner
            const insetWidth = window.innerHeight/ 4;
            const insetHeight = window.innerHeight / 4;
            this._threejs.setViewport(10, window.innerHeight - insetHeight - 50, insetWidth, insetHeight);
            this._threejs.setScissor(10, window.innerHeight - insetHeight - 50, insetWidth, insetHeight);
            this._threejs.setScissorTest(true);
            this._threejs.render(this._scene, this._topViewCamera);

            this._threejs.setScissorTest(false);  // Disable scissor test for main rendering

            this._Step(t - this._previousRAF);
            this._previousRAF = t;
        });
    }

    _Step(timeElapsed) {
        const timeElapsedS = Math.min(1.0 / 30.0, timeElapsed * 0.001);

        //this._UpdateSun();

        this._entityManager.Update(timeElapsedS);
    }
}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
    _APP = new BulletHell();
});