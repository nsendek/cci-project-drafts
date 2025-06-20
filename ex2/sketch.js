import { PoseLandmarker, FilesetResolver, HandLandmarker } from 'mediapipe';
import { Vector3 } from 'three';

/**
* How MediaPipe defines keypoints in there poses, this is different from ThreeJS
* @typedef {Object} Pose
* @property {number|undefined} id (optional)
* @property {Vector3[]} landmarks - 2D coordinates to draw on a debug canvas (optional)
* @property {Vector3[]} worldLandmarks - 3D coordinates to use in 3D environemnts.
* @property {Vector3} alignmentVector - Average Alignment of all the 3D points from the pose root.
*/

const POSE_SIZE = config.poseType == 'HAND' ? 21 : 33;

const sketch = (p) => {
  let video;
  let lastVideoTime = -1;

  let landmarker;
  let currentNumPoses = 0;
  let poseBuffers = []; // To average out signal?
  let poses = [];
  let averagePoses = [];

  p.preload = async () => {
    await createLandmarker();
  }

  p.setup = () => {
    p.createCanvas(640, 480);
    if (config.videoUrl) {
      useVideoFile();
    } else {
      useWebcam();
    }
  }

  function useWebcam() {
    video = p.createCapture(p.VIDEO);
    video.size(640, 480);
    video.hide();
    detectionLoop();
  }

  function useVideoFile() {
    video = p.createVideo(config.videoUrl);
    video.loop();
    video.hide();
    window.video = video;

    video.elt.addEventListener("loadeddata", detectionLoop);
  }

  p.draw = () => {
    // Draw the webcam video
    p.background(0);

    p.image(video, 0, 0, p.width, p.height);

    // 2D landmarks
    poses.forEach((pose, k) => {
      for (let i = 0; i < pose.landmarks.length; i++) {
        let point = pose.landmarks[i];
        if (point) {
          setFill(k);
          // p.fill(255, 0, 0);
          p.noStroke();
          p.circle(point.x * p.width, point.y * p.height, 10);
        }
      }
    })

    // Averaged landmarks
    // averagePoses.forEach(pose => {
    //   if (!pose) return;
    //   for (let i = 0; i < pose.landmarks.length; i++) {
    //     let point = pose.landmarks[i];
    //     if (point) {
    //       p.fill(0, 0, 255);
    //       p.noStroke();
    //       p.circle(point.x * p.width, point.y * p.height, 10);
    //     }
    //   }
    // })
  }

  function setFill(poseId) {
    switch (poseId) {
      case 0:
        p.fill(255, 0, 0);
        break;
      case 1:
        p.fill(0, 255, 0);
        break;
      case 2:
        p.fill(0, 0, 255);
        break;
      default:
    }
  }

  function gotPoses(results) {
    // Filter out poses without a high enough confidence.
    poses = results.filter(pose => pose.confidence > 0.9);
    if (!poses.length) {
      return;
    }
    poses.forEach(pose => {
      pose.alignmentVector = getAverageVectorKeypoint(pose);
    })
    EventBus.getInstance().emit('poses', poses);
  }

  const createLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    switch (config.poseType) {
      case 'HAND':
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: 'VIDEO',
          numHands: config.numPoses
        });
        break;
      case 'BODY':
        landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
            delegate: "GPU"
          },
          runningMode: 'VIDEO',
          numPoses: config.numPoses,
          minPoseDetectionConfidence: 0.9,
          minPosePresenceConfidence: 0.9,
          minTrackingConfidence: 0.9
        });
        break;
      default:
        break;
    }
    window.landmarker = landmarker;
  };

  function detectionLoop() {
    const videoElt = video.elt
    if (video.elt.currentTime !== lastVideoTime) {
      detectLandmarks(processResults);
      lastVideoTime = videoElt.currentTime;
    }
    requestAnimationFrame(detectionLoop);
  }

  function detectLandmarks(callback) {
    if (!landmarker) {
      return;
    }
    if (config.poseType == 'HAND') {
      callback(landmarker.detectForVideo(video.elt, performance.now()))
    } else {
      landmarker.detectForVideo(video.elt, performance.now(), callback);
    }
  }

  let count = 0;
  function processResults(results) {
    if (!results) {
      return;
    }
    const numPoses = results.landmarks.length;
    if (!numPoses) {
      return;
    }


    if (currentNumPoses > numPoses) {
      // console.log('poses num changed')
      // Drop the not used poses. How?
      currentNumPoses = numPoses;
    }

    const out = []
    for (let i = 0; i < numPoses; i++) {
      const [
        worldLandmarks,
        alignmentVector
      ] = convertWorldLandmarksAndAlignment(results.worldLandmarks[i]);

      /** @type {Pose} */
      const pose = {
        id: count,
        landmarks: results.landmarks[i].map(createVectorFromObject), // Not needed.
        worldLandmarks: worldLandmarks,
        alignmentVector,
      };
      out.push(pose);
      if (!poseBuffers[i]) {
        poseBuffers[i] = [];
      }
      const buffer = poseBuffers[i];
      buffer.push(pose);

      if (buffer.length > config.poseBufferSize) {
        buffer.shift();
      }
      count++;
    }
    poses = out;
    averagePoses = getAveragePoses();
  }

  p.mouseClicked = () => {
    console.log(poses);
    // console.log(averagePoses);
  }

  let paused = false;
  p.keyPressed = () => {
    if (p.keyCode == 32) {
      if (paused) video.play();
      else video.pause();
      paused = !paused;
    }
  }

  function createVectorFromObject(point) {
    return new Vector3(point.x, point.y, point.z);
  }

  function convertWorldLandmarksAndAlignment(landmarks) {
    const rootVector = createVectorFromObject(landmarks[0]);
    const vectors = [rootVector]
    const alignmentVector = new Vector3(0, 0, 0);

    for (let i = 1; i < landmarks.length; i++) {
      const landmark = createVectorFromObject(landmarks[i]);
      vectors.push(landmark);
      alignmentVector.add(
        new Vector3().subVectors(landmark, rootVector)
      );
    }

    alignmentVector.normalize();
    return [vectors, alignmentVector];
  }

  /**
   * Get the the average pose of all sampled poses. MAX 3.
   * @returns {Pose[]}
   */
  function getAveragePoses() {
    return poseBuffers.map(buffer => getAverageFromPoseBuffer(buffer));
  }

  /**
   * @param {Pose[]} buffer - Last three samples of the same Pose that will be averaged out to a single sample.
   * @returns {Pose}
   */
  function getAverageFromPoseBuffer(buffer) {
    if (buffer.length !== config.poseBufferSize) {
      return undefined;
    }
    /** @type {Pose} */
    const out = {
      landmarks: [],
      worldLandmarks: [],
      alignmentVector: new Vector3(0, 0, 0)
    };
    const bufferSizeInv = 1.0 / config.poseBufferSize;

    for (let i = 0; i < config.poseBufferSize; i++) {
      const endOfBuffer = i === (config.poseBufferSize - 1);
      const pose = buffer[i];

      out.alignmentVector.add(pose.alignmentVector);
      if (endOfBuffer) {
        out.alignmentVector.multiplyScalar(bufferSizeInv);
      }

      for (let j = 0; j < POSE_SIZE; j++) {
        if (i == 0) { // First pose sample.
          out.landmarks[j] = new Vector3(0, 0, 0);
          out.worldLandmarks[j] = new Vector3(0, 0, 0);
        }
        const landmarks = out.landmarks[j];
        const worldLandmarks = out.worldLandmarks[j];
        landmarks.add(pose.landmarks[j]);
        worldLandmarks.add(pose.worldLandmarks[j]);

        if (endOfBuffer) {
          landmarks.multiplyScalar(bufferSizeInv);
          worldLandmarks.multiplyScalar(bufferSizeInv);
        }
      }
    }
    return out;
  }
}

new p5(sketch);