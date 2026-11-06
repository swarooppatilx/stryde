import HealthKit
import SwiftUI
import WatchKit

/// Receives the workout the phone asked for (`HKHealthStore.startWatchApp(with:)`) and hands it to the manager.
final class AppDelegate: NSObject, WKApplicationDelegate {
  func handle(_ workoutConfiguration: HKWorkoutConfiguration) {
    Task { @MainActor in
      await WorkoutManager.shared.start(workoutConfiguration)
    }
  }
}

@main
struct StrydeWatchApp: App {
  @WKApplicationDelegateAdaptor private var appDelegate: AppDelegate
  @StateObject private var workout = WorkoutManager.shared

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(workout)
        .task { await workout.requestAuthorization() }
    }
  }
}
