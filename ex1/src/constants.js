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

export const BODYPOSE_LIMBS = [
  [0, 11, 13, 15],
  [0, 12, 14, 16],
  [0, 23, 25, 27],
  [0, 24, 26, 28],
];

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

export const HANDPOSE_LIMBS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 13, 14, 15, 16],
  [0, 9, 10, 11, 12],
  [0, 17, 18, 19, 20],
];