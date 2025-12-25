import * as THREE from 'three';
import { Uniform } from "three"; // three.js Uniform wrapper for shader uniforms
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'; // HDR environment map loader
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // GLTF model loader
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js'; // camera controls

let renderer, scene, camera, controls;

let contentContainer = document.getElementById('content-container');
let glbContainer = document.getElementById('glb-container');
let textContainer = document.getElementById('text-container');

let sceneGLB = [sceneGLB0, sceneGLB1, sceneGLB2];
let mesh = [mesh0, mesh1, mesh2];
let text = ["Ich bin der nullte Text der etwas platz einnimmt lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ich bin der erste Text der etwas platz einnimmt lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ich bin der zweite Text der etwas platz einnimmt lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."];

function init() {
    //setup renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('content-container').appendChild(renderer.domElement);

    setupScene();
    setupGLB();
    setupText();

    document.getElementById('text-container').innerText = text[0];


}

function setupScene() {
    sceneGLB[0] = new THREE.Scene();
}

function setupGLB() {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('/mesh/mesh0.glb', (gltf) => {
        mesh[0] = gltf.scene;
        mesh[0].scale.set(10, 10, 10);  // Scale the model
        mesh[0].position.set(0, 0, 0);  // Position the model
        sceneGLB[0].add(mesh[0]);
    });
}

function setupText() {
    sceneGLB[0].add(text[0]);
}


function animate() {
}