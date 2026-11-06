import SwiftUI

struct ContentView: View {
  @EnvironmentObject private var workout: WorkoutManager

  var body: some View {
    VStack(spacing: 8) {
      Text(workout.heartRate > 0 ? "\(Int(workout.heartRate))" : "--")
        .font(.system(size: 44, weight: .bold, design: .rounded))
      Text("BPM").font(.caption).foregroundStyle(.secondary)
      Button(workout.running ? "End" : "Start") {
        workout.running ? workout.end() : workout.start()
      }
      .tint(.accentColor)
    }
  }
}
