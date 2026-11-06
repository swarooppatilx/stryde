import Foundation
import HealthKit
import WatchConnectivity

/// Holds the workout the watch mirrors to the phone. Set up at launch: iOS may wake the app in the
/// background to hand over a mirrored session before any JavaScript runs.
final class WatchBridge: NSObject {
  static let shared = WatchBridge()

  let store = HKHealthStore()
  private(set) var mirrored: HKWorkoutSession?
  var onSample: (([String: Any]) -> Void)?
  var onState: ((String) -> Void)?

  private static let readTypes: Set<HKObjectType> = [
    HKQuantityType(.heartRate),
    HKQuantityType(.activeEnergyBurned),
    HKQuantityType(.distanceWalkingRunning),
    HKQuantityType(.distanceCycling),
    HKQuantityType(.stepCount),
    HKQuantityType(.runningPower),
    HKQuantityType(.runningSpeed),
    HKQuantityType(.cyclingPower),
    HKQuantityType(.cyclingSpeed),
    HKObjectType.workoutType(),
  ]
  private static let shareTypes: Set<HKSampleType> = [HKObjectType.workoutType()]

  /// Short keys the watch sends, and the names the app uses for them.
  private static let keys: [String: String] = [
    "t": "t", "hr": "heartRate", "d": "distance", "kcal": "calories",
    "spm": "cadence", "w": "power", "mps": "speed",
  ]

  func install() {
    store.workoutSessionMirroringStartHandler = { [weak self] session in
      self?.attach(session)
    }
    if WCSession.isSupported() {
      WCSession.default.delegate = self
      WCSession.default.activate()
    }
  }

  private func attach(_ session: HKWorkoutSession) {
    mirrored = session
    session.delegate = self
    onState?("running")
  }

  // MARK: Status and permission

  func status() async -> String {
    guard HKHealthStore.isHealthDataAvailable(), WCSession.isSupported() else { return "unsupported" }
    let watch = WCSession.default
    // Activation happens at launch and is quick; give it a moment the first time.
    for _ in 0..<10 where watch.activationState != .activated {
      try? await Task.sleep(nanoseconds: 100_000_000)
    }
    if !watch.isPaired { return "not-paired" }
    if !watch.isWatchAppInstalled { return "not-installed" }
    let request = try? await store.statusForAuthorizationRequest(
      toShare: Self.shareTypes, read: Self.readTypes)
    return request == .unnecessary ? "ready" : "needs-permission"
  }

  func requestAccess() async -> String {
    try? await store.requestAuthorization(toShare: Self.shareTypes, read: Self.readTypes)
    return await status()
  }

  // MARK: Commands

  func start(sport: String) async -> Bool {
    let configuration = HKWorkoutConfiguration()
    switch sport {
    case "ride": configuration.activityType = .cycling
    case "walk": configuration.activityType = .walking
    case "hike": configuration.activityType = .hiking
    default: configuration.activityType = .running
    }
    configuration.locationType = .outdoor
    return await withCheckedContinuation { continuation in
      store.startWatchApp(with: configuration) { success, _ in
        continuation.resume(returning: success)
      }
    }
  }

  func pause() { mirrored?.pause() }
  func resume() { mirrored?.resume() }
  /// Stops the watch's workout; the watch then saves it to Apple Health.
  func end() {
    mirrored?.stopActivity(with: Date())
  }

  private func decode(_ data: Data) -> [String: Any]? {
    guard let raw = try? JSONSerialization.jsonObject(with: data) as? [String: Double] else {
      return nil
    }
    var sample: [String: Any] = [:]
    for (short, value) in raw {
      if let name = Self.keys[short] { sample[name] = value }
    }
    return sample["t"] == nil ? nil : sample
  }
}

extension WatchBridge: HKWorkoutSessionDelegate {
  func workoutSession(
    _ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState, date: Date
  ) {
    switch toState {
    case .running: onState?("running")
    case .paused: onState?("paused")
    case .stopped, .ended:
      onState?("ended")
      if toState == .ended { mirrored = nil }
    default: break
    }
  }

  func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
    onState?("disconnected")
  }

  func workoutSession(
    _ workoutSession: HKWorkoutSession, didReceiveDataFromRemoteWorkoutSession data: [Data]
  ) {
    for item in data {
      if let sample = decode(item) { onSample?(sample) }
    }
  }

  func workoutSession(
    _ workoutSession: HKWorkoutSession, didDisconnectFromRemoteDeviceWithError error: Error?
  ) {
    onState?("disconnected")
  }
}

extension WatchBridge: WCSessionDelegate {
  func session(
    _ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) { session.activate() }
}
