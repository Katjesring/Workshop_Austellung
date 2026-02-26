import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // GLTF model loader
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js'; // camera controls

let renderer, controls;

let contentContainer = document.getElementById('content-container');
let textContainer = document.getElementById('text-container');
let overviewButton = document.getElementById('overview-button');
let overviewTitle = document.getElementById('overview-title');
let overviewInfo = document.getElementById('overview-info');

let sequence = [];
let platform;

let currentSequenceObjectID = 0;
let overviewSceneID = 0;  // Die Übersichtsszene ist immer Szene 0
let activePreviewRenderers = [];  // Speichert aktive Preview-Renderer zum Bereinigen
let activePreviewScenes = [];  // Speichert aktive Preview-Szenen zum Bereinigen

const gltfLoader = new GLTFLoader();

const clock = new THREE.Clock();
let lastSwitch = 0;

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

    // Erstelle Übersichtsszene
    createOverviewScene();

    await readJSON();
    setSceneText(sequence[currentSequenceObjectID].text);

    controls = new OrbitControls(sequence[currentSequenceObjectID].camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
    controls.minDistance = 10;  // Minimale Zoom-Distanz (wie nah darf man ran)
    controls.maxDistance = 100; // Maximale Zoom-Distanz (wie weit darf man raus)

    // Zeige Überschrift und Info beim Start (da wir in der Übersichtsszene starten)
    overviewTitle.style.display = 'block';
    overviewInfo.style.display = 'block';
    overviewButton.style.display = 'none';

    // Click-Handler für Übersicht-Button
    overviewButton.addEventListener('click', showOverview);

    // Resize-Handler für dynamische Textgroesse
    window.addEventListener('resize', onWindowResize);

}

function setSceneText(text) {
    textContainer.textContent = text || '';
    requestAnimationFrame(fitTextToContainer);
}

function fitTextToContainer() {
    const maxSize = 120;
    const minSize = 14;
    const container = textContainer;
    if (!container) return;

    let size = maxSize;
    container.style.fontSize = `${size}px`;
    container.style.lineHeight = '1.1';

    while (size > minSize && (container.scrollHeight > container.clientHeight || container.scrollWidth > container.clientWidth)) {
        size -= 2;
        container.style.fontSize = `${size}px`;
    }
}

function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);

    const currentCamera = sequence[currentSequenceObjectID]?.camera;
    if (currentCamera && currentCamera.isPerspectiveCamera) {
        currentCamera.aspect = window.innerWidth / window.innerHeight;
        currentCamera.updateProjectionMatrix();
    }

    fitTextToContainer();
}

// Erstelle die Übersichtsszene mit Navigation zu anderen Szenen
function createOverviewScene() {
    let overviewScene = new THREE.Scene();
    
    let camera = new THREE.PerspectiveCamera(1, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 0, 5);

    overviewScene.add(new THREE.AmbientLight(0xffffff, 0.5));

    sequence.push({
        scene: overviewScene,
        camera: camera,
        text: "",
        isOverview: true
    });
}

// Zeige die Übersichtsszene an
function showOverview() {
    currentSequenceObjectID = overviewSceneID;
    setSceneText(sequence[currentSequenceObjectID].text);
    controls.object = sequence[currentSequenceObjectID].camera;
    updateOverviewButtons();
    overviewTitle.style.display = 'block';
    overviewButton.style.display = 'none';
    overviewInfo.style.display = 'block';
    lastSwitch = clock.getElapsedTime();
}

// Hilfsfunktion zum rekursiven Freigeben von Ressourcen
function disposeScene(scene) {
    scene.traverse((object) => {
        if (object.geometry) {
            object.geometry.dispose();
        }
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.material.forEach(material => {
                    disposeMaterial(material);
                });
            } else {
                disposeMaterial(object.material);
            }
        }
    });
}

function disposeMaterial(material) {
    if (material.map) material.map.dispose();
    if (material.lightMap) material.lightMap.dispose();
    if (material.bumpMap) material.bumpMap.dispose();
    if (material.normalMap) material.normalMap.dispose();
    if (material.specularMap) material.specularMap.dispose();
    if (material.envMap) material.envMap.dispose();
    material.dispose();
}

// Erstelle oder aktualisiere die Navigationbuttons für die Übersichtsszene
function updateOverviewButtons() {
    // ZUERST: Stoppe alle Preview-Rendering
    activePreviewRenderers.forEach((renderer) => {
        if (renderer.stopRendering) {
            try {
                renderer.stopRendering();
            } catch (e) {
                console.error('Error stopping preview:', e);
            }
        }
    });
    
    // ZWEITENS: Gebe Resources frei
    activePreviewRenderers.forEach((renderer, index) => {
        const scene = activePreviewScenes[index];
        if (scene) {
            try {
                disposeScene(scene);
            } catch (e) {
                console.error('Error disposing scene:', e);
            }
        }
        try {
            renderer.dispose();
            renderer.forceContextLoss();
        } catch (e) {
            console.error('Error disposing renderer:', e);
        }
    });
    
    activePreviewRenderers = [];
    activePreviewScenes = [];
    
    // Gebe dem Browser Zeit zum Aufräumen
    setTimeout(() => {
        // Entferne alte Button-Grid falls vorhanden
        let oldGrid = document.querySelector('.button-grid');
        if (oldGrid) oldGrid.remove();

        // Erstelle neue Button-Grid
        let buttonGrid = document.createElement('div');
        buttonGrid.className = 'button-grid';

        // Erstelle Buttons für alle Nicht-Übersichts-Szenen
        for (let i = 1; i < sequence.length; i++) {
            let button = document.createElement('button');
            button.className = 'scene-button';
            
            // Erstelle Container für Preview und Text
            let buttonContent = document.createElement('div');
            buttonContent.style.display = 'flex';
            buttonContent.style.flexDirection = 'column';
            buttonContent.style.alignItems = 'center';
            buttonContent.style.width = '100%';
            buttonContent.style.height = '100%';
            
            // Erstelle Preview-Canvas
            let previewWrapper = document.createElement('div');
            previewWrapper.className = 'preview-wrapper';

            let previewCanvas = document.createElement('canvas');
            previewCanvas.width = 300;
            previewCanvas.height = 300;
            previewCanvas.style.borderRadius = '35px';

            let previewSpinner = document.createElement('div');
            previewSpinner.className = 'preview-spinner';
            
            // Lade Modell-Preview
            createModelPreview(previewCanvas, sequence[i].meshRef, previewSpinner);

            previewWrapper.appendChild(previewCanvas);
            previewWrapper.appendChild(previewSpinner);
            
            buttonContent.appendChild(previewWrapper);
            button.appendChild(buttonContent);
            
            button.addEventListener('click', () => {
                // Räume Preview-Renderer auf bevor wir die szene wechseln
                activePreviewRenderers.forEach((renderer) => {
                    if (renderer.stopRendering) renderer.stopRendering();
                });
                activePreviewRenderers = [];
                activePreviewScenes = [];
                
                currentSequenceObjectID = i;
                setSceneText(sequence[currentSequenceObjectID].text);
                controls.object = sequence[currentSequenceObjectID].camera;
                buttonGrid.remove();  // Entferne die Buttons
                overviewTitle.style.display = 'none';  // Verstecke Überschrift
                overviewInfo.style.display = 'none';  // Verstecke Info-Text
                overviewButton.style.display = 'block';  // Zeige Home-Button
                lastSwitch = clock.getElapsedTime();
            });
            buttonGrid.appendChild(button);
        }

        document.body.appendChild(buttonGrid);
    }, 50);
}

// Erstelle einen 3D-Preview für ein Modell
function createModelPreview(canvas, meshRef, spinner) {
    const previewRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    previewRenderer.setSize(300, 300);
    previewRenderer.setClearColor(0x000000, 0.2);
    
    const previewScene = new THREE.Scene();
    
    // Speichere Renderer und Szene zum späteren Bereinigen
    activePreviewRenderers.push(previewRenderer);
    activePreviewScenes.push(previewScene);
    
    const previewCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    previewCamera.position.set(0, 0, 2);
    
    previewScene.add(new THREE.AmbientLight(0xffffff, 0.8));
    
    let spotLight = new THREE.SpotLight(0xffffff);
    spotLight.position.set(1, 1, 1);
    spotLight.power = 50;
    previewScene.add(spotLight);
    
    let animationFrameID = null;
    let isStillRendering = true;
    
    // Lade das Modell
    const hideSpinner = () => {
        if (spinner) spinner.style.display = 'none';
    };

    gltfLoader.load(meshRef, (gltf) => {
        if (!isStillRendering) return;  // Abbruch wenn bereits aufgeräumt
        
        let mesh = gltf.scene;
        mesh.scale.set(2.2, 2.2, 2.2);
        previewScene.add(mesh);

        hideSpinner();
        
        // Zentere das Modell
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        mesh.position.sub(center);
        
        // Animiere den Preview
        function animatePreview() {
            if (!isStillRendering) {
                if (animationFrameID) cancelAnimationFrame(animationFrameID);
                return;
            }
            animationFrameID = requestAnimationFrame(animatePreview);
            mesh.rotation.y += 0.01;
            try {
                previewRenderer.render(previewScene, previewCamera);
            } catch (e) {
                isStillRendering = false;
            }
        }
        animatePreview();
    }, undefined, () => {
        hideSpinner();
    });
    
    // Speichere Funktion zum Stoppen
    previewRenderer.stopRendering = () => {
        isStillRendering = false;
        if (animationFrameID) {
            cancelAnimationFrame(animationFrameID);
            animationFrameID = null;
        }
    };
}

function generateScene(sceneObj) {

    let newScene = new THREE.Scene();

    let newCamera = new THREE.PerspectiveCamera(1, window.innerWidth / window.innerHeight, 0.1, 10000);
    newCamera.position.set(0, 4, -80);

    newScene.add(new THREE.AmbientLight(0xffffff, 0.2));



    gltfLoader.load("/mesh/platform.glb", (gltf) => {
        platform = gltf.scene;
        platform.scale.set(0.5, 0.5, 0.5);  // Scale the model
        platform.position.set(0, -0.6, 0);  // Position the model
        newScene.add(platform);
    });

    let newMesh;
    gltfLoader.load(sceneObj.meshRef, (gltf) => {
        newMesh = gltf.scene;
        newMesh.scale.set(1, 1, 1);  // Scale the model
        newMesh.position.set(0, -0.475, 0);  // Position the model
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
        text: sceneObj.text,
        meshRef: sceneObj.meshRef
    }

    sequence.push(newSequenceObj);
}

function showNextScene() {
    // Überspringe die Übersichtsszene bei der automatischen Rotation
    let nextID = currentSequenceObjectID + 1;
    if (nextID >= sequence.length || nextID === overviewSceneID) {
        nextID = 1;  // Gehe zu Scene 1 (erste echte 3D-Scene)
    }
    
    currentSequenceObjectID = nextID;
    setSceneText(sequence[currentSequenceObjectID].text);
    controls.object = sequence[currentSequenceObjectID].camera;
    
    // Entferne Übersichts-Buttons falls sichtbar
    let buttonGrid = document.querySelector('.button-grid');
    if (buttonGrid) buttonGrid.remove();
    
    // Verstecke Überschrift und Info, zeige Home-Button
    overviewTitle.style.display = 'none';
    overviewInfo.style.display = 'none';
    overviewButton.style.display = 'block';
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
        for (let i = 0; i < jsonSequence.length; i++) {
            generateScene(jsonSequence[i]);
        }

        // Zeige die Übersichts-Buttons nach dem Laden aller Szenen
        updateOverviewButtons();
    } catch (error) {
        console.error('Error reading or parsing the file:', error);
        return null;
    }
}

function animate() {
    controls.update();

    const elapsed = clock.getElapsedTime();
    // Auto-rotate nur wenn man nicht in der Übersichtsszene ist
    if (elapsed - lastSwitch >= 12 && currentSequenceObjectID !== overviewSceneID) {
        showNextScene();
        lastSwitch = elapsed;
    }

    renderer.render(sequence[currentSequenceObjectID].scene, sequence[currentSequenceObjectID].camera);
}