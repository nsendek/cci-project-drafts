import * as THREE from 'three';
import * as constants from './constants.js';

export class EventBus {
    // Static property to track instances
  static instance;

  static getInstance() {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  constructor() {
    this.events = {};
  }

  on(event, handler) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(handler);
    return () => {
      this.events[event] = this.events[event].filter(h => h !== handler);
    }
  }

  emit(event, payload) {
    if (!this.events[event]) return;
    this.events[event].forEach(handler => handler(payload));
  }
}

/**
* How ML5 defines keypoints in there poses, this is different from ThreeJS
* @typedef {Object} Keypoint3D
* @property {number} x
* @property {number} y
* @property {number} z
*/

/**
 * Returns the a unit vector represents the averaged vector of this given pose.
 * it creates a vector from the root point to all other points and averages them out.
 * @param pose 
 * 
 * @returns {Keypoint3D}
 */
export function getAverageVectorKeypoint(pose) {
  /** @type {Keypoint3D[]} */
  const keypoints = pose.keypoints3D;

  const rootKeypoint = keypoints[0];

  /** @type {Keypoint3D} */
  const out = { x: 0, y: 0, z: 0 };

  for (let i = 1; i < keypoints.length; i++) {
    const keypoint = keypoints[i];

    /** @type {Keypoint3D} */
    const offset = {
      x: keypoint.x - rootKeypoint.x,
      y: keypoint.y - rootKeypoint.y,
      z: keypoint.z - rootKeypoint.z,
    };
    out.x += offset.x;
    out.y += offset.y;
    out.z += offset.z;
  }
  const magnitude = Math.sqrt(out.x * out.x + out.y * out.y + out.z * out.z);
  out.x /= magnitude;
  out.y /= magnitude;
  out.z /= magnitude;
  return out;
}

/**
 * 
 * @param {Keypoint3D} vector 
 * @returns {THREE.QuaternionLike}
 */
export function getQuaternionForAlignmentVector(vector) {
  const originalUp = new THREE.Vector3(0, 1, 0);
  const newUp = keypointToVector3(vector); // new THREE.Vector3(vector.x, vector.y, vector.z); 

  // Normalize the new up vector to ensure it's a unit vector
  newUp.normalize();

  // Calculate the axis of rotation (cross product)
  const axis = new THREE.Vector3().crossVectors(originalUp, newUp).normalize();

  // Calculate the angle of rotation (dot product)
  const angle = originalUp.angleTo(newUp);

  // Create the quaternion representing the rotation
  const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);

  return quaternion.invert(); // invert so you can use it to convert back to the space...
}

/**
 * Ml5 Keypoints seem to be in negative space up-axis is (-Y). So i multiply
 * them by -1 to get vectors that align with how ThreeJS is set up.
 * @param {Keypoint3D} keypoint 
 * @returns {THREE.Vector3}
 */
export function keypointToVector3(keypoint) {
  return config.poseType === 'hand'
  ? new THREE.Vector3(keypoint.x, keypoint.y, keypoint.z).multiplyScalar(-1)
  : new THREE.Vector3(keypoint.x * -1, keypoint.y, keypoint.z * -1)
}

export function getPoseLimbs() {
  return config.poseType === 'hand' ? constants.HANDPOSE_LIMBS : constants.BODYPOSE_LIMBS;
}