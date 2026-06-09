import { Vector3, Euler, Quaternion } from 'three'

// Shared, mutable camera controller. Lives outside React so per-frame updates
// never re-render. Inputs come from three places that all coexist:
//   - moveInput  (left stick / WASD)        -> translation
//   - turnInput  (right stick / arrow keys) -> continuous look
//   - applyLook  (mouse drag)               -> incremental look
export function createCameraController() {
  const EYE = .5 // low eye level → columns read ~5× your height, world feels large
  const MAX_SPEED = 4
  const ACCEL = 9
  const TURN_SPEED = 1.8 // rad/s for held keys/stick
  const LOOK_SENS = 0.0042 // rad per pixel dragged
  const PITCH_LIMIT = 1.2
  const BASE_FOV = 28

  const state = {
    position: new Vector3(0, EYE, 0),
    yaw: 0,
    pitch: 0,
    fov: BASE_FOV,
    bobY: 0,
    moveInput: { x: 0, y: 0 },
    turnInput: { x: 0, y: 0 },
  }

  const velocity = new Vector3()
  const desired = new Vector3()
  const forward = new Vector3()
  const right = new Vector3()
  const quat = new Quaternion()
  const euler = new Euler(0, 0, 0, 'YXZ')
  let yawVel = 0
  let bobPhase = 0

  const clampPitch = (p) => Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, p))

  return {
    state,
    setMove(x, y) {
      state.moveInput.x = x
      state.moveInput.y = y
    },
    setTurn(x, y) {
      state.turnInput.x = x
      state.turnInput.y = y
    },
    // mouse drag: incremental look
    applyLook(dx, dy) {
      state.yaw -= dx * LOOK_SENS
      state.pitch = clampPitch(state.pitch - dy * LOOK_SENS)
    },
    reset() {
      state.position.set(0, EYE, 0)
      state.yaw = 0
      state.pitch = 0
      state.moveInput.x = state.moveInput.y = 0
      state.turnInput.x = state.turnInput.y = 0
      velocity.set(0, 0, 0)
      yawVel = 0
    },
    // Teleport on the XZ plane (used by the year picker). Clear input/momentum so
    // a key/stick held during the jump doesn't immediately drift you off the row.
    jumpTo(x, z) {
      state.position.x = x
      state.position.z = z
      state.moveInput.x = state.moveInput.y = 0
      state.turnInput.x = state.turnInput.y = 0
      velocity.set(0, 0, 0)
      yawVel = 0
    },
    update(dt) {
      const delta = Math.min(dt, 0.05)

      // continuous look from keys/stick
      const targetYawVel = -state.turnInput.x * TURN_SPEED
      yawVel += (targetYawVel - yawVel) * Math.min(1, 10 * delta)
      state.yaw += yawVel * delta
      state.pitch = clampPitch(state.pitch + state.turnInput.y * TURN_SPEED * 0.6 * delta)

      // movement on the XZ plane relative to yaw (pitch doesn't affect walking)
      euler.set(0, state.yaw, 0)
      quat.setFromEuler(euler)
      forward.set(0, 0, -1).applyQuaternion(quat)
      right.set(1, 0, 0).applyQuaternion(quat)
      desired
        .set(0, 0, 0)
        .addScaledVector(forward, state.moveInput.y)
        .addScaledVector(right, state.moveInput.x)
      if (desired.lengthSq() > 1) desired.normalize()
      desired.multiplyScalar(MAX_SPEED)
      velocity.lerp(desired, Math.min(1, ACCEL * delta))
      state.position.addScaledVector(velocity, delta)
      state.position.y = EYE

      // head bob (FOV stays CONSTANT — a speed-based FOV kick reads as a
      // dolly-zoom "stretch" during accel/decel).
      const speed = velocity.length()
      const speedN = Math.min(1, speed / MAX_SPEED)
      bobPhase += speed * delta * 1.1
      state.bobY = Math.sin(bobPhase) * 0.04 * speedN
      state.fov = BASE_FOV
    },
  }
}
