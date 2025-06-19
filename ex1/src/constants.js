
export const MAX_NUMBER_POSES = 3;

/**
 * Refer to
 * https://docs.ml5js.org/#/reference/bodypose?id=bodyposedetectstart
 * 
 * It's a reduced version of the BlazePose connections. Loses a bunch of
 * unneeded nodes.
 * 
 *           (0) HEAD
 *    --------|---------
 *  (12)   |      |   (11)
 *    |    |      |    |
 *  (14)   |      |   (13)
 *    |    |      |    |
 *  (16)   |      |   (15)
 *         |      |
 *       (24)   (23)
 *         |      |
 *       (26)   (25)
 *         |      |        
 *       (28)   (27)
 */

export const BODYPOSE_SIZE = 33;

export const BODYPOSE_LIMBS = [
  [0, 11, 13, 15],
  // [0, 12, 14, 16],
  // [0, 23, 25, 27],
  [0, 24, 26, 28],
];

export const BODYPOSE_END_INDICES = [15, 16, 27, 28];

export const BODYPOSE_IGNORED_INDICES = [
  ...[ 12, 14, 16],
  ...[ 23, 25, 27],
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22, 29, 30, 31, 32
]

/**
 * Refer to 
 * https://docs.ml5js.org/#/reference/handpose?id=handposedetectstart
 * 
 *              (0) WRIST
 *               |
 *      ---------------------
 *    |     |     |     |     |
 *   (1)   (5)   (9)  (13)  (17)
 *    |     |     |     |     |
 *   (2)   (6)  (10)  (14)  (18)
 *    |     |     |     |     |
 *   (3)   (7)  (11)  (15)  (19)
 *    |     |     |     |     |
 *   (4)   (8)  (12)  (16)  (20)
 */

export const HANDPOSE_SIZE = 21;

export const HANDPOSE_IGNORED_INDICES = [
  // 1, 2, 3, 4,
  // 5, 6, 7, 8,
  // 9, 10, 11, 12,
  // 13, 14, 15, 16,
  // 17, 18, 19, 20
];

export const HANDPOSE_END_INDICES = [4, 8, 12, 16, 20];

export const HANDPOSE_LIMBS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 13, 14, 15, 16],
  [0, 9, 10, 11, 12],
  [0, 17, 18, 19, 20],
];