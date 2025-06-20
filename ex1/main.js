import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { keypointToVector3 } from './src/util.js';
import { startML5 } from './src/poses.js';
import { PoseTree, SmartBone, getMemoizedSkinnedMesh } from './src/tree.js'
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, controls, poseTree, worldTreeRoot, gui, folder;

let lastTime = Date.now();
let currentTime = Date.now();

const sceneLights = [];
const sceneWalls = [];
const ROOM_SIZE = 2500;


const points = [];
let count = 0;
window.poseCount = 0;

main();

function main() {
  if (config.debugMode) {
    window.THREE = THREE; // so i can test stuff out in console.
  }

  init();
  render();
}

function init() {
  camera = new THREE.PerspectiveCamera(110, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = ROOM_SIZE / 2;
  scene = new THREE.Scene();
  renderer = new THREE.WebGLRenderer();

  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  document.getElementById('main').appendChild(renderer.domElement);
  document.body.style.touchAction = 'none';

  window.addEventListener('resize', onWindowResize);

  setupEnviroment();

  setupLights();
  setupTree();
  startML5();
  setupDebug();
}

function render() {
  // Do a little recursing.
  requestAnimationFrame(render);
  currentTime = Date.now();

  camera.lookAt(scene.position);
  if (controls) {
    controls.update();
  }

  // updatePoseTrees();

  // let count = 0;
  SmartBone.getInstances().forEach(instance => {
    // if (instance.update()) count++;
    instance.update()
  })

  // if (points.length && poseTree.targetPose && poseTree.targetPose.alignmentVector) {
  //   const alignmentVector = keypointToVector3(poseTree.targetPose.alignmentVector);
  //   points[1] = alignmentVector.clone().multiplyScalar(200);
  //   line.geometry.setFromPoints(points);
  // }

  renderer.render(scene, camera);

  lastTime = currentTime;
}

function updatePoseTrees() {
  scene.updateMatrixWorld(true);
}

function setupDebug() {
  controls = new OrbitControls(camera, renderer.domElement);
  if (!config.debugMode) {
    return
  }
  const axis = new THREE.AxesHelper(1000);
  axis.setColors(0xff0000, 0x00ff00, 0x0000ff); // RGB
  scene.add(axis);

  gui = new GUI();
  folder = gui.addFolder('Root Bone');
  folder.add(worldTreeRoot.rotation, 'z', - Math.PI, Math.PI);
  folder.controllers[0].name('rotation.z');
}

function setupLights() {
  sceneLights[0] = new THREE.DirectionalLight(0xffffff, 3);
  sceneLights[1] = new THREE.DirectionalLight(0xffffff, 3);
  sceneLights[2] = new THREE.DirectionalLight(0xffffff, 3);

  sceneLights[0].position.set(0, 750, 0);
  sceneLights[1].position.set(375, 750, 375);
  sceneLights[2].position.set(-375, -750, -375);

  scene.add(sceneLights[0]);
  scene.add(sceneLights[1]);
  scene.add(sceneLights[2]);
}

function setupEnviroment() {
  const room = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);

  scene.background = new THREE.Color(0x000000);
  // scene.fog = new THREE.Fog( 0x888888, 10, 1500 );

  // const mat4 = new THREE.MeshPhongMaterial({ color: 0x555555, emissive: 0x072534, side: THREE.DoubleSide, flatShading: true });
  // const wall4 = new THREE.Mesh(geometry, mat4);
  // wall4.position.y = -ROOM_SIZE / 2;
  // wall4.rotation.x = Math.PI / 2;
  // sceneWalls.push(wall4);
  // room.add(wall4);

  scene.add(room);
}

function setupTree() {
  poseTree = new PoseTree(0, config.alignAllPosesUp);
  // if (poseTree.debugMode)
  worldTreeRoot = new THREE.Group();
  scene.add(worldTreeRoot)

  worldTreeRoot.add(poseTree.getRoot());

  // if (config.debugMode) scene.add(poseTree.getRoot());


  if (config.poseType == "body") {
    // root.position.y += 1000;
    // worldTreeRoot.rotation.z = Math.PI;
    // const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
    // scene.quaternion.copy(rotation);
    // scene.updateMatrixWorld(true);
  }
  // Simple
  recurseFill(poseTree, 1);

  // Reasonable max for Hands
  // recurseFill(poseTree, 3);

  // Reasonable max for Bodies
  // recurseFill(poseTree, 4);

  // Stress test for Hands
  // recurseFill(poseTree, 4);

  // Stress test for Bodies
  // Maybe can be done with debugMode=false
  // recurseFill(poseTree, 4); 

  // poseTree2 = new PoseTree(0, true);
  // poseTree2.scale = 0.5;
  // ends[1].add(poseTree2.getRoot())

  // poseTree3 = new PoseTree(0, true);
  // poseTree3.scale = 0.25;
  // ends[4].add(poseTree3.getRoot())

  // const endBone = poseTree.getEnds()[0]
  // endBone.add(createAngleBone());
  // endBone.parent.add(createAngleBone());
  // endBone.parent.parent.add(createAngleBone());
  // endBone.parent.parent.parent.add(createAngleBone());

  if (config.debugMode) {
    const skeletonHelper = new THREE.SkeletonHelper(poseTree.getRoot());
    scene.add(skeletonHelper);
  }

  if (config.hideMesh) {
    return;
  }
  PoseTree.getInstances().forEach(poseTree => {
    skinPoseTree(poseTree);
  });
}

function recurseFill(parentTree, level = 1, maxLevel = level) {
  if (level == 0) {
    return; // done
  }

  const ends = parentTree.getEnds();
  // ends.forEach(bone => bone.scale.multiplyScalar());
  ends.forEach(end => {
    const shouldAlignChildren = config.poseType == 'hand';
    const pt = new PoseTree(0, shouldAlignChildren);

    pt.scale = Math.pow(config.scaleFactor, maxLevel - level + 1);
    end.add(pt.getRoot());

    recurseFill(pt, level - 1, maxLevel);
  });
}

function skinPoseTree(poseTree) {
  const limbs = poseTree.getLimbs();
  limbs.forEach(bones => {
    const skeleton = new THREE.Skeleton(bones);
    const mesh = getMemoizedSkinnedMesh(poseTree.scale);
    const rootBone = bones[0];
    const rootBoneParent = poseTree.getRoot().parent;
    mesh.add(rootBone);
    mesh.bind(skeleton);

    window.poseCount++;
    rootBoneParent.add(mesh);
  })
}

function createAngleBone() {
  const bone = createBone();
  bone.position.x = 50;
  const childBone = createBone();
  childBone.position.y = 10;
  bone.add(childBone);
  return bone;
}

function createBone() {
  const bone = new THREE.Bone();
  const axis = new THREE.AxesHelper(10);
  axis.setColors(0xff0000, 0x00ff00, 0x0000ff); // RGB
  bone.add(axis);
  return bone;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}
