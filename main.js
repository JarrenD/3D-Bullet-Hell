import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.118/examples/jsm/controls/OrbitControls.js';


class BasicWorldDemo {
  constructor() {
    this._Initialize();
  }

  _Initialize() {
    this._threejs = new THREE.WebGLRenderer({
      antialias: true,
    });
    this._threejs.shadowMap.enabled = true;
    this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
    this._threejs.setPixelRatio(window.devicePixelRatio);
    this._threejs.setSize(window.innerWidth, window.innerHeight);

    document.body.appendChild(this._threejs.domElement);

    window.addEventListener('resize', () => {
      this._OnWindowResize();
    }, false);

    const fov = 60;
    const aspect = 1920 / 1080;
    const near = 1.0;
    const far = 1000.0;
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this._camera.position.set(20, 20, 20);
    //let cameraTarget = new THREE.Vector3();
    

    this._scene = new THREE.Scene();

    let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    light.position.set(20, 100, 10);
    light.target.position.set(0, 0, 0);
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 500.0;
    light.shadow.camera.left = 100;
    light.shadow.camera.right = -100;
    light.shadow.camera.top = 100;
    light.shadow.camera.bottom = -100;
    this._scene.add(light);

    light = new THREE.AmbientLight(0x101010);
    this._scene.add(light);

    const controls = new OrbitControls(
      this._camera, this._threejs.domElement);
    controls.target.set(0, 20, 0);
    controls.update();

    const loader = new THREE.CubeTextureLoader();
    const texture = loader.load([
        './resources/posx.jpg',
        './resources/negx.jpg',
        './resources/posy.jpg',
        './resources/negy.jpg',
        './resources/posz.jpg',
        './resources/negz.jpg',
    ]);
    this._scene.background = texture;

    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(100, 100, 10, 10),
        new THREE.MeshStandardMaterial({
            color: 0xD3D3D3,
          }));
    plane.castShadow = false;
    plane.receiveShadow = true;
    plane.rotation.x = -Math.PI / 2;
    this._scene.add(plane);
    
    const cylinderGeometry = new THREE.CylinderGeometry(
      // radiusTop: 
      1, 
      // radiusBottom: 
      1, 
      // height: 
      2, 
      // radialSegments: 
      32, 
      // heightSegments: 
      1, 
      // openEnded: 
      false, 
      // thetaStart: 
      0, 
      // thetaLength: 
      Math.PI * 2
    );
    
    const cylinderMaterial = new THREE.MeshStandardMaterial({
      color: 0xFF0000, // Red color
    });
    
    const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
    
    cylinder.position.set(0, 1, 0); // Set the position
    cylinder.castShadow = true; // Enable shadow casting
    cylinder.receiveShadow = true; // Enable shadow receiving
    cylinder.scale.set(2, 2, 2); 
    this._scene.add(cylinder); // Add to the scene
    

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({
          color: 0x0000FF,
      }));
    box.position.set(20, 1, 20);
    box.scale.set(2, 2, 2); 
    box.castShadow = true;
    box.receiveShadow = true;
    this._scene.add(box);

    this._RAF();
    
    function calculateDistance(x1, z1, x2, z2) {
      // Calculate the difference in x-coordinates and y-coordinates
      const xDifference = x2 - x1;
      const zDifference = z2 - z1;
    
      // Square the differences
      const squaredXDifference = xDifference * xDifference;
      const squaredZDifference = zDifference * zDifference;
    
      // Calculate the sum of squared differences
      const sumOfSquaredDifferences = squaredXDifference + squaredZDifference;
    
      // Calculate the square root of the sum of squared differences
      const distance = Math.sqrt(sumOfSquaredDifferences);
    
      // Return the distance
      return distance;
    }

    function calculateCircleCircumferencePoint(radius, theta) {
      // Convert theta to radians
      const thetaRadians = theta * (Math.PI / 180);
    
      // Calculate x and z coordinates
      const x = radius * Math.cos(thetaRadians);
      const z = radius * Math.sin(thetaRadians);
    
      // Return the coordinates as an object
      return { x: x, z: z };
    }

    function calculateDirectionVectorTowardsOrigin(x, z) {
      return { x: -x, z: -z };
    }
    
    function calculateDirectionVectorAwayFromOrigin(x, z) {
      return { x: x, z: z };
    }
    
    function normalizeDirectionVector(directionVector) {
      const magnitude = Math.sqrt(directionVector.x * directionVector.x + directionVector.z * directionVector.z);
      return {
        x: directionVector.x / magnitude,
        z: directionVector.z / magnitude
      };
    }
    
    function moveTowardsOrigin(box, distance) {
      const directionVector = calculateDirectionVectorTowardsOrigin(box.position.x, box.position.z);
      const normalizedDirectionVector = normalizeDirectionVector(directionVector);
      box.position.x += normalizedDirectionVector.x * distance;
      box.position.z += normalizedDirectionVector.z * distance;
      //updateCameraTarget(box.position.x,box.position.z);
    }
    
    function moveAwayFromOrigin(box, distance) {
      const directionVector = calculateDirectionVectorAwayFromOrigin(box.position.x, box.position.z);
      const normalizedDirectionVector = normalizeDirectionVector(directionVector);
      box.position.x += normalizedDirectionVector.x * distance;
      box.position.z += normalizedDirectionVector.z * distance;
      //updateCameraTarget(box.position.x,box.position.z);
    }

  //   function updateCameraTarget(moveX, moveZ) {
  //     // move camera
  //     this._camera.position.x += moveX
  //     this._camera.position.z += moveZ

  //     // update camera target
  //     this.cameraTarget.x = this.model.position.x
  //     this.cameraTarget.y = this.model.position.y + 1
  //     this.cameraTarget.z = this.model.position.z
  //     this.orbitControl.target = this.cameraTarget
  // }
    
    let theta = 0;

    document.addEventListener('keydown', (event) => {
      if (event.key === 'w') {
        moveTowardsOrigin(box, 1);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'a') {
        theta+=3;
        const updatePos = calculateCircleCircumferencePoint(calculateDistance(box.position.x,box.position.z,0,0),theta);
        box.position.x = updatePos.x;
        box.position.z = updatePos.z;
        //updateCameraTarget(updatePos.x,updatePos.z);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 's') {
        moveAwayFromOrigin(box, 1);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'd') {
        theta-=3;
        const updatePos = calculateCircleCircumferencePoint(calculateDistance(box.position.x,box.position.z,0,0),theta);
        box.position.x = updatePos.x;
        box.position.z = updatePos.z;
        //updateCameraTarget(updatePos.x,updatePos.z);
      }
    });
  
  }
 
  _OnWindowResize() {
    this._camera.aspect = window.innerWidth / window.innerHeight;
    this._camera.updateProjectionMatrix();
    this._threejs.setSize(window.innerWidth, window.innerHeight);
  }

  _RAF() {
    requestAnimationFrame(() => {
      this._threejs.render(this._scene, this._camera);
      this._RAF();
    });
  }

  
 }

// function isWKeyPressed() {
//     // Check if the 'w' key is currently pressed.
//     return event.key === 'w';
//   }
 
//   function isAKeyPressed() {
//     // Check if the 'w' key is currently pressed.
//     return event.key === 'a';
//   }
//   function isSKeyPressed() {
//     // Check if the 'w' key is currently pressed.
//     return event.key === 's';
//   }
//   function isDKeyPressed() {
//     // Check if the 'w' key is currently pressed.
//     return event.key === 'd';
//   }  

//   document.addEventListener('keydown', function(event) {
//     if (isWKeyPressed()) {
//         box.position.x += 1;
//       console.log("The 'w' key is pressed!");
//     }
//     else if (isAKeyPressed()){
//         console.log("The 'a' key is pressed!");
//     }
//     else if (isSKeyPressed()){
//         console.log("The 's' key is pressed!");
//     }
//     else if (isDKeyPressed()){
//         console.log("The 'd' key is pressed!");
//     }
//   });



let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
  _APP = new BasicWorldDemo();
});