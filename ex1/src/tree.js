import * as THREE from 'three';
import {
  EventBus,
  getQuaternionForAlignmentVector,
  getPoseLimbs,
  getPoseSize,
  getEndIndices,
  getIgnoredIndices,
  keypointToVector3,
} from "./util.js";

/**
 * Store skinned mesh for whatever scale we're working with so that we don't duplicate work.
 */
const SKINNED_MESH_MEMO = {};
window.SKINNED_MESH_MEMO = SKINNED_MESH_MEMO;

const POSE_TREE_MATERIAL = new THREE.MeshPhongMaterial({
  color: 0x156289,
  // emissive: 0xffffff,
  // emissiveIntensity: 0.05,
  side: THREE.DoubleSide,
  flatShading: config.flatShading,
  transparent: true,
  // opacity: 0.6,
  shininess: 10
});

/**
 * Class that merges a ThreeJS Bone + Skeleton objects with ML5's pose detector
 * data and gravitates towards them.
 */
export class PoseTree {
  // Static property to track instances
  static instances = [];

  static getInstances() {
    return PoseTree.instances;
  }

  /**
   * @param {number} [poseId=0] 
   * @param {boolean} [shouldAlign=false] - If true then when setting the new targetPose,
   *  we will align the points along the local up axis (+Y).
   */
  constructor(poseId = 0, shouldAlign = false) {
    this.poseId = poseId;
    this.keypointToParentMap = {};
    this.bones = [];
    this.scale = 1;
    this.shouldAlign = shouldAlign;
    this.targetPose = null;

    for (let i = 0; i < getPoseSize(); i++) {
      // skip pose points that don't matter.
      if (getIgnoredIndices().includes(i)) {
        continue;
      }

      const bone = new SmartBone();
      bone.position.copy(new THREE.Vector3(0, 10, 0));
      this.bones[i] = (bone);

      if (config.debugMode) {
        const axis = new THREE.AxesHelper(10);
        axis.setColors(0xff0000, 0x00ff00, 0x0000ff); // RGB
        bone.add(axis);
      }
    }

    getPoseLimbs().forEach(limb => {
      for (let i = 1; i < limb.length; i++) {
        const childId = limb[i];
        const parentId = limb[i - 1];
        this.keypointToParentMap[childId] = parentId;

        this.bones[parentId].add(this.bones[childId]);
      }
    });

    // Need to access this data often.
    EventBus.getInstance().on('poses', (poses) => {
      const pose = poses[this.poseId];
      if (!pose) {
        return;
      }
      this.setTarget(pose);
    });

    PoseTree.instances.push(this);
  }

  getValueScalar() {
    if (config.poseType == 'hand') {
      return 2500 * this.scale;
    }

    return 1000 * this.scale;
  }

  setTarget(targetPose) {
    this.targetPose = targetPose;
  }

  update() {
    if (!this.targetPose) {
      return;
    }
    this.align(this.targetPose);
  }

  align(targetPose) {
    const rootBone = this.bones[0];
    rootBone.updateMatrixWorld();
    for (let i = 1; i < getPoseSize(); i++) {
      if (getIgnoredIndices().includes(i)) {
        continue;
      }
      const parentId = this.keypointToParentMap[i];

      const bone = this.bones[i];
      const parentBone = bone.parent;

      parentBone.updateMatrixWorld();

      const alignQuat = this.shouldAlign
        ? getQuaternionForAlignmentVector(targetPose.alignmentVector)
        : new THREE.Quaternion();

      // TRANSLATE STEP
      // targetPose is position relative to the root of the chain so to get world
      // coordinates, we have to apply the rootBone's world matrix.
      const parentWorldPosition = keypointToVector3(targetPose.keypoints3D[parentId]);
      parentWorldPosition.applyQuaternion(alignQuat);
      parentWorldPosition.multiplyScalar(this.getValueScalar());
      parentWorldPosition.applyMatrix4(rootBone.matrixWorld);

      const childWorldPosition = keypointToVector3(targetPose.keypoints3D[i]);
      childWorldPosition.applyQuaternion(alignQuat);
      childWorldPosition.multiplyScalar(this.getValueScalar());
      childWorldPosition.applyMatrix4(rootBone.matrixWorld);

      const worldOffset = new THREE.Vector3().subVectors(childWorldPosition, parentWorldPosition);

      const parentWorldQuatInvert = new THREE.Quaternion();
      parentBone.getWorldQuaternion(parentWorldQuatInvert).invert();

      const localOffset = worldOffset.clone().applyQuaternion(parentWorldQuatInvert);
      bone.setTargetPosition(localOffset);

      // ROTATE STEP: 
      // Align up-axis (+Y) to new direction.
      const targetUp = worldOffset.clone().normalize(); // target up axis in world space.
      const localUp = new THREE.Vector3(0, 1, 0); // node local up axis.
      const rotationQuat = new THREE.Quaternion().setFromUnitVectors(localUp, targetUp);

      rotationQuat.premultiply(parentWorldQuatInvert); // <- CHATGPT
      bone.setTargetQuaternion(rotationQuat);
    }
  }

  getRoot() {
    return this.bones[0];
  }

  getBones() {
    return this.bones.filter(bone => !!bone);
  }

  getBonesForSeparateSkeletons() {
    return getPoseLimbs().map(
      limbIndices => limbIndices.map(i => this.bones[i])
    );
  }

  getEnds() {
    return getEndIndices().map(i => this.bones[i]);
  }
}

/**
 * A version of the bone class that constantly interpolates 
 * to a target postion and quaternion. Not every bone will be this
 * only bones used for pose tracking.
 */
export class SmartBone extends THREE.Bone {
  // Static property to track instances
  static instances = [];

  poseId = 0;

  static getInstances() {
    return SmartBone.instances;
  }

  constructor(poseId) {
    super();
    this.poseId = poseId;
    SmartBone.instances.push(this);
  }

  setTargetPosition(position) {
    this.targetPosition = position;
  }

  setTargetQuaternion(quaternion) {
    this.targetQuaternion = quaternion;
  }

  /**
   * Update bone closer towards its target position and rotation.
   */
  update() {
    let updateDone = false;
    if (this.targetPosition) {
      if (this.position.distanceTo(this.targetPosition) >= 5) {  // scale of the scene is like 1000 so
        this.position.lerp(this.targetPosition, config.lerpFactor);
        updateDone = true;
      } else {
        this.position.copy(this.targetPosition);
      }
    }
    if (this.targetQuaternion) {
      if (this.quaternion.angleTo(this.targetQuaternion) > 0.05) { // in radians 0 -> 6.28
        this.quaternion.slerp(this.targetQuaternion, config.lerpFactor);
        updateDone = true;
      } else {
        this.quaternion.copy(this.targetQuaternion);
      }
    }
    return updateDone;
  }
}

/**
 * 
 * @param {number} scale 
 */
export function getMemoizedSkinnedMesh(scale) {
  if (SKINNED_MESH_MEMO[scale]) {
    return SKINNED_MESH_MEMO[scale].clone();
  }
  const segmentLength = 10;
  const boneCount = config.poseType == 'hand' ? 5 : 4; // I GET TO ASSUME BONE COUNT CAUSE ALL MY LIMBS HAVE THE SAME # BONES.
  const totalLength = segmentLength * (boneCount);
  const heightSegments = 10; // More segments = smoother skinning

  const geometry = new THREE.CylinderGeometry(100 * scale * config.scaleFactor, 100 * scale, totalLength, 8, heightSegments, true);
  // Shift geometry so base is at y=0 (like the root bone)
  geometry.translate(0, totalLength / 2, 0);

  // Assign skinning attributes <- Thanks ChatGPT
  const position = geometry.attributes.position;
  const skinIndices = [];
  const skinWeights = [];

  const vertex = new THREE.Vector3();

  // console.log(position.count)
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const y = vertex.y; 
    // console.log('y', y)

    // Determine bone indices and blend amount
    const boneLength = totalLength / (boneCount - 1);
    let boneIndex = Math.floor(y / boneLength);
    let nextBoneIndex = boneIndex + 1;

    if (nextBoneIndex >= boneCount) {
      nextBoneIndex = boneCount - 1;
      boneIndex = boneCount - 2;
    }

    const localY = y - boneIndex * boneLength;
    const weight = 1 - (localY / boneLength);

    skinIndices.push(boneIndex, nextBoneIndex, 0, 0);
    skinWeights.push(weight, 1 - weight, 0, 0);
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  const mesh = new THREE.SkinnedMesh(geometry, POSE_TREE_MATERIAL);
  SKINNED_MESH_MEMO[scale] = mesh;

  return mesh.clone();
}