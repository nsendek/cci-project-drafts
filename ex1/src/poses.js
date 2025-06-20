import { EventBus, getAverageVectorKeypoint } from './util.js';

const sketch = (p) => {
  let pose;
  let video;
  let paused = false;
  let poses;

  const debugVideoScale = 0.6;

  p.preload = () => {
    // Load the handPose model
    if (config.poseType == 'hand') {
      pose = ml5.handPose({ maxHands: config.numPoses });
    } else {
      pose = ml5.bodyPose("BlazePose");
    }

    // Save to global state.
    window.poseModel = pose;
  }

  p.setup = () => {
    if (config.debugMode) {
      p.createCanvas(640 * debugVideoScale, 480 * debugVideoScale);
    } else {
      p.noCanvas();
    }

    if (config.videoUrl) {
      useVideoFile();
    } else {
      useWebcam();
    }

    // start detecting hands from the webcam video
    pose.detectStart(video, gotPoses);

    console.log('ml5 ready');
  }

  function useWebcam() {
    video = p.createCapture(p.VIDEO);
    video.size(640, 480);
    video.hide();
  }

  function useVideoFile() {
    video = p.createVideo(config.videoUrl);
    video.loop();
    video.hide();
  }

  p.draw = () => {
    p.image(video, 0, 0, p.width, p.height);

    if (!poses || !poses.length) {
      return;
    }

    poses.forEach(pose => {
      for (let j = 0; j < pose.keypoints.length; j++) {
        let keypoint = pose.keypoints[j];
        if (config.poseType === 'body' && keypoint.confidence < 0.1) {
          continue;
        }
        p.fill(255, 0, 0);
        p.noStroke();
        p.circle(
          keypoint.x / video.width * p.width, 
          keypoint.y / video.height * p.height, 
          5
        );
      }
    });
  }

  p.keyPressed = () => {
    if (p.keyCode == 32) {
      if (paused) {
        pose.detectStart(video, gotPoses);
        if (video) video.play();
      } else {
        pose.detectStop();
        if (video) video.pause();
      }
      paused = !paused;
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
}

// The version of ml5 i'm currently using requires
// p5js so doing this work around.
export function startML5() {
  new p5(sketch);
}
