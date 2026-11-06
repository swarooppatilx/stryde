import Foundation
import HealthKit

/// Runs the workout the phone started, mirrors it back to the phone and streams a reading every second.
@MainActor
final class WorkoutManager: NSObject, ObservableObject {
  static let shared = WorkoutManager()

  let healthStore = HKHealthStore()

  @Published private(set) var state: HKWorkoutSessionState = .notStarted
  @Published private(set) var heartRate: Double = 0
  @Published private(set) var distance: Double = 0
  @Published private(set) var speed: Double = 0
  @Published private(set) var startDate: Date?
  @Published private(set) var cycling = false

  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var ticker: Timer?
  /// Recent (time, total steps) pairs, for steps per minute over the last few seconds.
  private var stepHistory: [(Date, Double)] = []

  static let readTypes: Set<HKObjectType> = [
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

  static let shareTypes: Set<HKSampleType> = [
    HKObjectType.workoutType(),
    HKQuantityType(.activeEnergyBurned),
    HKQuantityType(.distanceWalkingRunning),
    HKQuantityType(.distanceCycling),
    HKQuantityType(.heartRate),
  ]

  var isActive: Bool { state == .running || state == .paused }

  /// Time spent moving: pauses are left out.
  func elapsed(at date: Date) -> TimeInterval { builder?.elapsedTime(at: date) ?? 0 }

  func requestAuthorization() async {
    guard HKHealthStore.isHealthDataAvailable() else { return }
    try? await healthStore.requestAuthorization(toShare: Self.shareTypes, read: Self.readTypes)
  }

  func start(_ configuration: HKWorkoutConfiguration) async {
    guard session == nil else { return }
    do {
      let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
      let builder = session.associatedWorkoutBuilder()
      builder.dataSource = HKLiveWorkoutDataSource(
        healthStore: healthStore, workoutConfiguration: configuration)
      session.delegate = self
      builder.delegate = self
      self.session = session
      self.builder = builder
      cycling = configuration.activityType == .cycling
      heartRate = 0
      distance = 0
      speed = 0
      stepHistory = []

      let start = Date()
      startDate = start
      session.startActivity(with: start)
      try await builder.beginCollection(at: start)
      try await session.startMirroringToCompanionDevice()
      startTicker()
    } catch {
      reset()
    }
  }

  func pause() { session?.pause() }
  func resume() { session?.resume() }
  /// Ending on the watch: stops the activity; the state change finishes and saves the workout.
  func end() { session?.stopActivity(with: .now) }

  private func startTicker() {
    ticker?.invalidate()
    ticker = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
      Task { @MainActor in await WorkoutManager.shared.sendSample() }
    }
  }

  private func quantity(_ id: HKQuantityTypeIdentifier) -> HKStatistics? {
    builder?.statistics(for: HKQuantityType(id))
  }

  /// The latest numbers, sent to the phone as a small JSON object.
  private func sendSample() async {
    guard let session, state == .running else { return }
    let now = Date()
    var sample: [String: Double] = ["t": (now.timeIntervalSince1970 * 1000).rounded()]

    let bpm = HKUnit.count().unitDivided(by: .minute())
    if let hr = quantity(.heartRate)?.mostRecentQuantity()?.doubleValue(for: bpm) {
      heartRate = hr
      sample["hr"] = hr
    }
    let distanceId: HKQuantityTypeIdentifier = cycling ? .distanceCycling : .distanceWalkingRunning
    if let meters = quantity(distanceId)?.sumQuantity()?.doubleValue(for: .meter()) {
      distance = meters
      sample["d"] = meters
    }
    if let kcal = quantity(.activeEnergyBurned)?.sumQuantity()?.doubleValue(for: .kilocalorie()) {
      sample["kcal"] = kcal
    }
    let powerId: HKQuantityTypeIdentifier = cycling ? .cyclingPower : .runningPower
    if let watts = quantity(powerId)?.mostRecentQuantity()?.doubleValue(for: .watt()) {
      sample["w"] = watts
    }
    let speedId: HKQuantityTypeIdentifier = cycling ? .cyclingSpeed : .runningSpeed
    let mps = HKUnit.meter().unitDivided(by: .second())
    if let value = quantity(speedId)?.mostRecentQuantity()?.doubleValue(for: mps) {
      speed = value
      sample["mps"] = value
    }
    if !cycling, let steps = quantity(.stepCount)?.sumQuantity()?.doubleValue(for: .count()) {
      stepHistory.append((now, steps))
      stepHistory.removeAll { now.timeIntervalSince($0.0) > 10 }
      if let first = stepHistory.first, now.timeIntervalSince(first.0) >= 3 {
        let spm = (steps - first.1) / now.timeIntervalSince(first.0) * 60
        if spm > 0 { sample["spm"] = spm }
      }
    }

    guard let data = try? JSONSerialization.data(withJSONObject: sample) else { return }
    try? await session.sendToRemoteWorkoutSession(data: data)
  }

  private func finish(at date: Date) async {
    ticker?.invalidate()
    ticker = nil
    session?.end()
    do {
      try await builder?.endCollection(at: date)
      _ = try await builder?.finishWorkout()
    } catch {}
    reset()
  }

  private func reset() {
    ticker?.invalidate()
    ticker = nil
    session = nil
    builder = nil
    startDate = nil
    state = .notStarted
  }
}

extension WorkoutManager: HKWorkoutSessionDelegate {
  nonisolated func workoutSession(
    _ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState,
    from fromState: HKWorkoutSessionState, date: Date
  ) {
    Task { @MainActor in
      self.state = toState
      // Stopped from either device (the phone stops the mirrored session): save and close.
      if toState == .stopped { await self.finish(at: date) }
    }
  }

  nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {}

  nonisolated func workoutSession(
    _ workoutSession: HKWorkoutSession, didDisconnectFromRemoteDeviceWithError error: Error?
  ) {}
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
  nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

  nonisolated func workoutBuilder(
    _ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>
  ) {}
}
