import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // GLTF model loader
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js'; // camera controls

let renderer, controls;

let contentContainer = document.getElementById('content-container');
let textContainer = document.getElementById('text-container');

let sequence = [];
let platform;

let currentSequenceObjectID = 0;

const gltfLoader = new GLTFLoader();

// initialize everything and start the render loop
await init();
renderer.setAnimationLoop(animate);

async function init() {
    //setup renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    contentContainer.appendChild(renderer.domElement);

    await readJSON();
    textContainer.textContent = sequence[currentSequenceObjectID].text;

    controls = new OrbitControls(sequence[currentSequenceObjectID].camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;

}

function generateScene(sceneObj) {

    let newScene = new THREE.Scene();

    let newCamera = new THREE.PerspectiveCamera(1, window.innerWidth / window.innerHeight, 0.1, 10000);
    newCamera.position.set(0, 4, -55);

    newScene.add(new THREE.AmbientLight(0xffffff, 0.2));



    gltfLoader.load("/mesh/platform.glb", (gltf) => {
        platform = gltf.scene;
        platform.scale.set(0.5, 0.5, 0.5);  // Scale the model
        platform.position.set(0, -0.5, 0);  // Position the model
        newScene.add(platform);
    });

    let newMesh;
    gltfLoader.load(sceneObj.meshRef, (gltf) => {
        newMesh = gltf.scene;
        newMesh.scale.set(1, 1, 1);  // Scale the model
        newMesh.position.set(0, -0.375, 0);  // Position the model
        newScene.add(newMesh);
    });

    let spotLight = new THREE.SpotLight(0xffffff);
    spotLight.position.set(2, 2, 2);
    spotLight.castShadow = true;
    spotLight.target.position.set(0, 0, 0);
    spotLight.power = 100;
    newScene.add(spotLight);
    newScene.add(spotLight.target);

    let newSequenceObj = {
        scene: newScene,
        camera: newCamera,
        text: sceneObj.text
    }

    sequence.push(newSequenceObj);
}

function showNextScene() {
    if (currentSequenceObjectID < (sequence.length - 1)) {
        currentSequenceObjectID++;
    }
    else {
        currentSequenceObjectID = 0;
    }
    textContainer.textContent = sequence[currentSequenceObjectID].text;
    controls.object = sequence[currentSequenceObjectID].camera;
}

async function readJSON() {
    try {
        // Fetch the JSON file
        const response = await fetch("/json/data.json");

        // Check if the response is okay
        if (!response.ok) {
            throw new Error('Cannot fetch data.json');
        }

        // Parse the JSON content
        const jsonObject = await response.json();

        let jsonSequence = [];
        jsonObject.objects.forEach(item => jsonSequence.push(item));

        let currentSeqLength = sequence.length;
        for (let i = 0; i < jsonSequence.length - currentSeqLength; i++) {
            generateScene(jsonSequence[currentSeqLength + i]);
        }
    } catch (error) {
        console.error('Error reading or parsing the file:', error);
        return null;
    }
}

const clock = new THREE.Clock();
let lastSwitch = 0;

function animate() {
    controls.update();

    const elapsed = clock.getElapsedTime();
    if (elapsed - lastSwitch >= 12) {
        showNextScene();
        lastSwitch = elapsed;
    }

    renderer.render(sequence[currentSequenceObjectID].scene, sequence[currentSequenceObjectID].camera);
}