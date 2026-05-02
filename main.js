import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // GLTF model loader
import { OrbitControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js'; // camera controls

let renderer, controls;

let contentContainer = document.getElementById('content-container');
let textContainer = document.getElementById('text-container');
let overviewButton = document.getElementById('overview-button');
let overviewTitle = document.getElementById('overview-title');
let overviewInfo = document.getElementById('overview-info');
let arrowLeft = document.getElementById('arrow-left');
let arrowRight = document.getElementById('arrow-right');
let treeButton = document.getElementById('tree-button');
let roomButton = document.getElementById('room-button');
let backgroundElement = null;  // Element für Background-Bilder
let imageOverlay = null;       // Element für imageBild / imageText Anzeige
let currentViewIndex = 0;      // 0=mesh, 1=imageBild, 2=imageText

let sequence = [];
let platform;

let currentSequenceObjectID = 0;
let overviewSceneID = 0;  // Die Übersichtsszene ist immer Szene 0

THREE.Cache.enabled = false;
const gltfLoader = new GLTFLoader();

// const clock = new THREE.Clock();
// let lastSwitch = 0;

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

    controls = new OrbitControls(sequence[currentSequenceObjectID].camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
    controls.minDistance = 10;  // Minimale Zoom-Distanz (wie nah darf man ran)
    controls.maxDistance = window.innerWidth < 900 ? 130 : 100; // Maximale Zoom-Distanz (wie weit darf man raus)
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 3 / 4;

    // Zeige Überschrift und Info beim Start (da wir in der Übersichtsszene starten)
    overviewTitle.style.display = 'block';
    overviewInfo.style.display = 'flex';
    overviewButton.style.display = 'none';
    treeButton.style.display = 'flex';
    roomButton.style.display = 'flex';

    // Click-Handler für Übersicht-Button
    overviewButton.addEventListener('click', (e) => { e.stopPropagation(); showOverview(); });

    // Klick auf Baum-Button leitet auf Garten-Unterseite weiter
    treeButton.addEventListener('click', () => {
        window.location.href = '/tree';
    });

    // Klick auf Raum-Button leitet auf Vorraum-Unterseite weiter
    roomButton.addEventListener('click', () => {
        window.location.href = '/room';
    });

    // Click-Handler für Pfeile
    arrowLeft.addEventListener('click', () => showView(currentViewIndex - 1));
    arrowRight.addEventListener('click', () => showView(currentViewIndex + 1));

    // Resize-Handler für dynamische Textgroesse
    window.addEventListener('resize', onWindowResize);
}

function setSceneBackground(backgroundPath) {
    // Erstelle Background-Element falls nicht vorhanden
    if (!backgroundElement) {
        backgroundElement = document.createElement('div');
        backgroundElement.id = 'background-image';
        backgroundElement.style.position = 'fixed';
        backgroundElement.style.top = '0';
        backgroundElement.style.left = '0';
        backgroundElement.style.width = '100%';
        backgroundElement.style.height = '100%';
        backgroundElement.style.backgroundSize = 'cover';
        backgroundElement.style.backgroundPosition = 'center';
        backgroundElement.style.backgroundRepeat = 'no-repeat';
        backgroundElement.style.zIndex = '-1';
        backgroundElement.style.transition = 'opacity 0.5s ease-in-out';
        document.body.appendChild(backgroundElement);
    }

    // Setze das neue Background-Bild
    if (backgroundPath) {
        backgroundElement.style.backgroundImage = `url('${backgroundPath}')`;
        backgroundElement.style.opacity = '1';
        backgroundElement.style.pointerEvents = 'none';
    } else {
        backgroundElement.style.opacity = '0';
        backgroundElement.style.pointerEvents = 'none';
    }
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
    if (currentSequenceObjectID === overviewSceneID) {
        resizeRendererFull();
    } else if (currentViewIndex === 0 && imageOverlay) {
        const activeCard = imageOverlay.querySelector(`.zeitkapsel-card[data-scene="${currentSequenceObjectID}"]`);
        const cardBox = activeCard?.querySelector('.card-box');
        if (cardBox) {
            resizeRendererToBox(cardBox);
            const cardsTrack = imageOverlay.querySelector('.cards-track');
            if (cardsTrack && activeCard) {
                const cardIndex = currentSequenceObjectID - 1;
                const cardWidth = activeCard.offsetWidth;
                const offset = cardIndex * (cardWidth + 24) - (window.innerWidth - cardWidth) / 2;
                cardsTrack.style.transform = `translateX(${-offset}px)`;
            }
        }
    }
    fitTextToContainer();
}

function resizeRendererFull() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    sequence.forEach(s => {
        if (s.camera && s.camera.isPerspectiveCamera) {
            s.camera.aspect = window.innerWidth / window.innerHeight;
            s.camera.updateProjectionMatrix();
        }
    });
}

function resizeRendererToBox(imageBox) {
    const rect = imageBox.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        renderer.setSize(rect.width, rect.height);
        sequence.forEach(s => {
            if (s.camera && s.camera.isPerspectiveCamera) {
                s.camera.aspect = rect.width / rect.height;
                s.camera.updateProjectionMatrix();
            }
        });
    }
}

// Erstelle die Übersichtsszene mit Navigation zu anderen Szenen
function createOverviewScene() {
    let overviewScene = new THREE.Scene();
    
    let camera = new THREE.PerspectiveCamera(1, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 0, 3);

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
    // Canvas zurück in den Body für Vollbild-Übersicht
    document.body.appendChild(contentContainer);
    contentContainer.style.position = '';
    contentContainer.style.inset = '';
    contentContainer.style.zIndex = '';
    contentContainer.style.display = 'block';
    resizeRendererFull();

    currentSequenceObjectID = overviewSceneID;
    setSceneBackground(null);  // Keine Background auf der Übersichtsseite
    controls.object = sequence[currentSequenceObjectID].camera;
    controls.target.set(0, 0, 0);
    controls.update();
    updateOverviewButtons();
    overviewTitle.style.display = 'block';
    overviewButton.style.display = 'none';
    overviewInfo.style.display = 'flex';
    arrowLeft.style.display = 'none';
    arrowRight.style.display = 'none';
    treeButton.style.display = 'flex';
    roomButton.style.display = 'flex';
    if (imageOverlay) imageOverlay.style.display = 'none';
}

// Gibt die verfügbaren Views für eine Szene zurück
function getViewsForScene(sceneObj) {
    let views = ['mesh'];
    if (sceneObj && sceneObj.imageBild) views.push('imageBild');
    if (sceneObj && sceneObj.imageText) views.push('imageText');
    return views;
}

// Schaltet auf den angegebenen View-Index um (zyklisch)
function showView(index) {
    const sceneObj = sequence[currentSequenceObjectID];
    const views = getViewsForScene(sceneObj);
    currentViewIndex = ((index % views.length) + views.length) % views.length;
    const view = views[currentViewIndex];

    // Overlay einmalig erstellen
    if (!imageOverlay) {
        imageOverlay = document.createElement('div');
        imageOverlay.id = 'image-overlay';
        document.body.appendChild(imageOverlay);

    }

    // Karussell aufbauen: eine Karte pro Zeitkapsel-Szene
    let cardsTrack = imageOverlay.querySelector('.cards-track');
    if (!cardsTrack) {
        cardsTrack = document.createElement('div');
        cardsTrack.className = 'cards-track';
        imageOverlay.appendChild(cardsTrack);
    }
    for (let i = 1; i < sequence.length; i++) {
        if (!cardsTrack.querySelector(`.zeitkapsel-card[data-scene="${i}"]`)) {
            const card = document.createElement('div');
            card.className = 'zeitkapsel-card';
            card.dataset.scene = String(i);

            const cardTitle = document.createElement('div');
            cardTitle.className = 'card-title';
            cardTitle.innerHTML = sequence[i].title ? `<strong>ZEITKAPSEL</strong> – ${sequence[i].title}` : '<strong>ZEITKAPSEL</strong>';
            cardTitle.style.cursor = 'pointer';
            cardTitle.addEventListener('click', (e) => {
                if (parseInt(card.dataset.scene) === currentSequenceObjectID) {
                    e.stopPropagation();
                    showOverview();
                }
            });

            const cardBox = document.createElement('div');
            cardBox.className = 'card-box';
            const bg = sequence[i].background;
            if (bg) cardBox.style.backgroundImage = `url('${bg}')`;

            const cardCaption = document.createElement('div');
            cardCaption.className = 'card-caption';
            cardCaption.innerHTML = '<h2 class="caption-heading"></h2><p class="caption-body"></p>';

            card.appendChild(cardTitle);
            card.appendChild(cardBox);
            card.appendChild(cardCaption);

            // Zur Zeitkapsel navigieren wenn auf eine inaktive Karte getippt wird
            card.addEventListener('click', () => {
                const idx = parseInt(card.dataset.scene);
                if (idx !== currentSequenceObjectID) {
                    currentSequenceObjectID = idx;
                    currentViewIndex = 0;
                    setSceneBackground(sequence[idx].background);
                    controls.object = sequence[idx].camera;
                    controls.target.set(0, 0, 0);
                    controls.update();
                    updateArrows();
                    showView(0);
                }
            });

            cardsTrack.appendChild(card);
        }
    }

    imageOverlay.style.display = 'flex';

    // Karten auf Grundzustand zurücksetzen (Bilder bleiben gecached, nur ausgeblendet)
    cardsTrack.querySelectorAll('.zeitkapsel-card').forEach(card => {
        card.classList.remove('active-card');
        card.querySelectorAll('img.view-image').forEach(img => { img.style.display = 'none'; });
    });

    // Aktive Karte befüllen
    const activeCard = cardsTrack.querySelector(`.zeitkapsel-card[data-scene="${currentSequenceObjectID}"]`);
    activeCard.classList.add('active-card');
    const cardBox = activeCard.querySelector('.card-box');
    const cardCaption = activeCard.querySelector('.card-caption');

    // Pfeile in aktive Box
    cardBox.appendChild(arrowLeft);
    cardBox.appendChild(arrowRight);

    // Overview-Button in Titel der aktiven Karte
    const activeTitle = activeCard.querySelector('.card-title');
    activeTitle.appendChild(overviewButton);

    // Caption
    const captionKey = view === 'mesh' ? 'meshCaption' : view === 'imageBild' ? 'imageBildCaption' : view === 'imageText' ? 'imageTextCaption' : null;
    if (captionKey && sceneObj[captionKey]) {
        cardCaption.querySelector('.caption-heading').textContent = sceneObj[captionKey].heading;
        cardCaption.querySelector('.caption-body').textContent = sceneObj[captionKey].body;
        cardCaption.style.display = 'block';
    } else {
        cardCaption.style.display = 'none';
    }

    // Navigations-Punkte (nur bei mehreren Views)
    let dotsContainer = cardBox.querySelector('.view-dots');
    if (!dotsContainer) {
        dotsContainer = document.createElement('div');
        dotsContainer.className = 'view-dots';
        cardBox.appendChild(dotsContainer);
    }
    dotsContainer.innerHTML = '';
    if (views.length > 1) {
        views.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'view-dot' + (i === currentViewIndex ? ' active' : '');
            dotsContainer.appendChild(dot);
        });
    }

    // Canvas nur reparenten wenn nötig (vermeidet WebGL-Kontextverlust auf iOS)
    if (contentContainer.parentElement !== cardBox) {
        cardBox.appendChild(contentContainer);
        contentContainer.style.position = 'absolute';
        contentContainer.style.inset = '0';
        contentContainer.style.zIndex = '1';
    }

    if (view === 'mesh') {
        const bg = sequence[currentSequenceObjectID].background;
        cardBox.style.backgroundImage = bg ? `url('${bg}')` : '';
        contentContainer.style.display = 'block';
        requestAnimationFrame(() => resizeRendererToBox(cardBox));
    } else {
        contentContainer.style.display = 'none';
        cardBox.style.backgroundImage = '';
        // Bild-Element pro Karte/View einmalig erstellen und cachen statt jedes Mal neu zu laden
        let imgEl = activeCard.querySelector(`img.view-image[data-view="${view}"]`);
        if (!imgEl) {
            imgEl = document.createElement('img');
            imgEl.className = 'view-image';
            imgEl.dataset.view = view;
            imgEl.decoding = 'async';
            imgEl.src = sceneObj[view];
            cardBox.appendChild(imgEl);
        }
        imgEl.style.display = 'block';
    }

    // Karussell zur aktiven Karte verschieben + Overview-Button positionieren
    requestAnimationFrame(() => {
        const cardIndex = currentSequenceObjectID - 1;
        const cardWidth = activeCard.offsetWidth;
        const offset = cardIndex * (cardWidth + 24) - (window.innerWidth - cardWidth) / 2;
        cardsTrack.style.transform = `translateX(${-offset}px)`;

    });
}

// Pfeile ein-/ausblenden je nach verfügbaren Views
function updateArrows() {
    arrowLeft.style.display = 'none';
    arrowRight.style.display = 'none';
    const sceneObj = sequence[currentSequenceObjectID];
    const views = getViewsForScene(sceneObj);
    if (currentSequenceObjectID !== overviewSceneID && views.length > 1) {
        setTimeout(() => {
            arrowLeft.style.display = 'flex';
            arrowRight.style.display = 'flex';
        }, 420);
    }
}

// Erstelle oder aktualisiere die Navigationbuttons für die Übersichtsszene
function updateOverviewButtons() {
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

        // Preview-Wrapper mit Background als Fallback während des Ladens
        let previewWrapper = document.createElement('div');
        previewWrapper.className = 'preview-wrapper';
        const bg = sequence[i].background;
        if (bg) {
            previewWrapper.style.backgroundImage = `url('${bg}')`;
            previewWrapper.style.backgroundSize = 'cover';
            previewWrapper.style.backgroundPosition = 'center';
        }

        let previewSpinner = document.createElement('div');
        previewSpinner.className = 'preview-spinner';

        const previewVideoSrc = sequence[i].previewVideo;
        if (previewVideoSrc) {
            let previewVideo = document.createElement('video');
            previewVideo.className = 'preview-video';
            previewVideo.src = previewVideoSrc;
            previewVideo.autoplay = true;
            previewVideo.loop = true;
            previewVideo.muted = true;
            previewVideo.playsInline = true;
            previewVideo.setAttribute('playsinline', '');
            previewVideo.addEventListener('canplay', () => { previewSpinner.style.display = 'none'; });
            previewVideo.addEventListener('error', () => { previewSpinner.style.display = 'none'; });
            previewWrapper.appendChild(previewVideo);
        } else {
            previewSpinner.style.display = 'none';
        }
        previewWrapper.appendChild(previewSpinner);

        buttonContent.appendChild(previewWrapper);
        button.appendChild(buttonContent);

        button.addEventListener('click', () => {
            currentSequenceObjectID = i;
            setSceneBackground(sequence[currentSequenceObjectID].background);
            controls.object = sequence[currentSequenceObjectID].camera;
            controls.target.set(0, -0.1, 0);
            controls.update();
            buttonGrid.remove();  // Entferne die Buttons
            overviewTitle.style.display = 'none';  // Verstecke Überschrift
            overviewInfo.style.display = 'none';  // Verstecke Info-Text
            overviewButton.style.display = 'block';  // Zeige Home-Button
            treeButton.style.display = 'none';
            roomButton.style.display = 'none';
            currentViewIndex = 0;
            updateArrows();
            showView(0);
        });
        buttonGrid.appendChild(button);
    }

    document.body.appendChild(buttonGrid);
}

function generateScene(sceneObj) {

    let newScene = new THREE.Scene();

    let newCamera = new THREE.PerspectiveCamera(1, window.innerWidth / window.innerHeight, 0.1, 10000);
    newCamera.position.set(0, window.innerWidth < 900 ? 30 : 10, window.innerWidth < 900 ? -90 : -60);

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
        const s = sceneObj.scale ?? 1;
        newMesh.scale.set(s, s, s);
        // Normalize X/Z pivot so imported models stay centered in the view.
        const box = new THREE.Box3().setFromObject(newMesh);
        const center = box.getCenter(new THREE.Vector3());
        const yOffset = sceneObj.yOffset ?? -0.475;
        newMesh.position.set(-center.x, yOffset, -center.z);
        newScene.add(newMesh);
    });

    let spotLight = new THREE.SpotLight(0xffffff);
    spotLight.position.set(2, 2, 2);
    spotLight.target.position.set(0, 0, 0);
    spotLight.power = 50;
    newScene.add(spotLight);
    newScene.add(spotLight.target);


    let ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    newScene.add(ambientLight);

    let newSequenceObj = {
        scene: newScene,
        camera: newCamera,
        text: sceneObj.text,
        meshRef: sceneObj.meshRef,
        previewVideo: sceneObj.previewVideo,
        background: sceneObj.background,
        title: sceneObj.title,
        meshCaption: sceneObj.meshCaption,
        imageBild: sceneObj.imageBild,
        imageBildCaption: sceneObj.imageBildCaption,
        imageText: sceneObj.imageText,
        imageTextCaption: sceneObj.imageTextCaption
    }

    sequence.push(newSequenceObj);
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

    // const elapsed = clock.getElapsedTime();
    // // Auto-rotate nur wenn man nicht in der Übersichtsszene ist
    // if (elapsed - lastSwitch >= 12 && currentSequenceObjectID !== overviewSceneID) {
    //     showNextScene();
    //     lastSwitch = elapsed;
    // }

    renderer.render(sequence[currentSequenceObjectID].scene, sequence[currentSequenceObjectID].camera);
}