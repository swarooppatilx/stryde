import Foundation
import HealthKit

/// Runs one workout on the watch and keeps its live numbers.
@MainActor
final class WorkoutManager: NSObject, ObservableObject {
  let healthStore = HKHealthStore()

  @Published private(set) var heartRate: Double = 0
  @Published private(set) var running = false

  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?

  static let readTypes: Set<HKObjectType> = [
    HKQuantityType(.heartRate),
    HKQuantityType(.activeEnergyBurned),
    HKQuantityType(.distanceWalkingRunning),
    HKQuantityType(.distanceCycling),
    HKQuantityType(.stepCount),
    HKQuantityType(.runningPower),
    HKQuantityType(.runningSpeed),
    HKObjectType.workoutType(),
  ]

  func requestAuthorization() async {
    guard HKHealthStore.isHealthDataAvailable() else { return }
    try? await healthStore.requestAuthorization(
      toShare: [HKObjectType.workoutType()], read: Self.readTypes)
  }

  func start() {
    let configuration = HKWorkoutConfiguration()
    configuration.activityType = .running
    configuration.locationType = .outdoor
    do {
      let session = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
      let builder = session.associatedWorkoutBuilder()
      builder.dataSource = HKLiveWorkoutDataSource(
        healthStore: healthStore, workoutConfiguration: configuration)
      builder.delegate = self
      self.session = session
      self.builder = builder
      let start = Date()
      session.startActivity(with: start)
      builder.beginCollection(withStart: start) { _, _ in }
      running = true
    } catch {
      running = false
    }
  }

  func end() {
    session?.end()
    builder?.endCollection(withEnd: Date()) { [weak self] _, _ in
      self?.builder?.finishWorkout { _, _ in }
    }
    running = false
  }
}

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
  nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

  nonisolated func workoutBuilder(
    _ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>
  ) {
    let bpm = HKUnit.count().unitDivided(by: .minute())
    let value = workoutBuilder.statistics(for: HKQuantityType(.heartRate))?
      .mostRecentQuantity()?.doubleValue(for: bpm)
    Task { @MainActor in
      if let value { self.heartRate = value }
    }
  }
}
